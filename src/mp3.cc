#include "mp3.hh"

#include <mpg123.h>
#include <assert.h>
#include <stdio.h>
#include <vector>

using std::vector;
using std::string;

struct ScopedMHandle
{
  mpg123_handle *mh         = nullptr;
  bool           need_close = false;

  ~ScopedMHandle()
  {
    if (mh && need_close)
      mpg123_close (mh);

    if (mh)
      mpg123_delete (mh);
  }
};

void
mp3_init()
{
  static bool mpg123_init_ok = false;
  if (!mpg123_init_ok)
    {
      int err = mpg123_init();
      if (err != MPG123_OK)
        {
          fprintf (stderr, "audiowmark: init mpg123 lib failed\n");
          exit (1);
        }
      mpg123_init_ok = true;
    }
}

/* there is no really simple way of detecting if something is an mp3
 *
 * so we try to decode a few frames; if that works without error the
 * file is probably a valid mp3
 */
bool
mp3_detect (const string& filename)
{
  int err = 0;

  mp3_init();

  mpg123_handle *mh = mpg123_new (NULL, &err);
  if (err != MPG123_OK)
    return false;

  auto smh = ScopedMHandle { mh }; // cleanup on return

  err = mpg123_param (mh, MPG123_ADD_FLAGS, MPG123_QUIET, 0);
  if (err != MPG123_OK)
    return false;

  err = mpg123_open (mh, filename.c_str());
  if (err != MPG123_OK)
    return false;

  smh.need_close = true;

  long rate;
  int channels;
  int encoding;
  err = mpg123_getformat (mh, &rate, &channels, &encoding);
  if (err != MPG123_OK)
    return false;

  size_t buffer_bytes = mpg123_outblock (mh);
  unsigned char buffer[buffer_bytes];

  for (size_t i = 0; i < 10; i++)
    {
      size_t done;
      err = mpg123_read (mh, buffer, buffer_bytes, &done);
      if (err == MPG123_NEW_FORMAT)
        {
          /* format change: ok */
        }
      else if (err == MPG123_DONE)
        {
          return true;
        }
      else if (err != MPG123_OK)
        {
          return false;
        }
    }
  return true;
}

string
mp3_load (const string& filename, WavData& wav_data)
{
  int err = 0;

  mp3_init();

  mpg123_handle *mh = mpg123_new (NULL, &err);
  if (err != MPG123_OK)
    return "mpg123_new failed";

  auto smh = ScopedMHandle { mh }; // cleanup on return

  err = mpg123_param (mh, MPG123_ADD_FLAGS, MPG123_QUIET, 0);
  if (err != MPG123_OK)
    return "setting quiet mode failed";

  // allow arbitary amount of data for resync */
  err = mpg123_param (mh, MPG123_RESYNC_LIMIT, -1, 0);
  if (err != MPG123_OK)
    return "setting resync limit parameter failed";

  // force floating point output
  {
    const long *rates;
    size_t      rate_count;

    mpg123_format_none (mh);
    mpg123_rates (&rates, &rate_count);

    for (size_t i = 0; i < rate_count; i++)
      {
        err = mpg123_format (mh, rates[i], MPG123_MONO|MPG123_STEREO, MPG123_ENC_FLOAT_32);
        if (err != MPG123_OK)
          return mpg123_strerror (mh);
      }
  }

  err = mpg123_open (mh, filename.c_str());
  if (err != MPG123_OK)
    return mpg123_strerror (mh);

  smh.need_close = true;

  long rate;
  int channels;
  int encoding;

  err = mpg123_getformat (mh, &rate, &channels, &encoding);
  if (err != MPG123_OK)
    return mpg123_strerror (mh);

  /* ensure that the format will not change */
  mpg123_format_none (mh);
  mpg123_format (mh, rate, channels, encoding);

  size_t buffer_bytes = mpg123_outblock (mh);
  assert (buffer_bytes % sizeof (float) == 0);

  vector<float> buffer (buffer_bytes / sizeof (float));
  vector<float> samples;

  while (true)
    {
      size_t done = 0;

      err = mpg123_read (mh, reinterpret_cast<unsigned char *> (&buffer[0]), buffer_bytes, &done);
      if (err == MPG123_OK)
        {
          const size_t n_values = done / sizeof (float);
          samples.insert (samples.end(), buffer.begin(), buffer.begin() + n_values);
        }
      else if (err == MPG123_DONE)
        {
          wav_data = WavData (samples, channels, rate, 24);

          return ""; /* success */
        }
      else if (err == MPG123_NEED_MORE)
        {
          // some mp3s have this error before reaching eof -> harmless
        }
      else
        {
          return mpg123_strerror (mh);
        }
    }
}
