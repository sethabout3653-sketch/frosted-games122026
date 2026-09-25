/**
 * Scramjet Proxy Configuration
 * Specially configured for Soundboard Guys (https://soundboardguys.com)
 */
self.__scramjet$config = {
  prefix: '/scramjet/service/',
  bare: '/bare/',
  encodeUrl: (url) => {
    if (!url) return '';
    return encodeURIComponent(
      url
        .split('')
        .map((char, ind) =>
          ind % 2 === 0 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char
        )
        .join('')
    );
  },
  decodeUrl: (str) => {
    if (!str) return '';
    try {
      const decodedUri = decodeURIComponent(str);
      return decodedUri
        .split('')
        .map((char, ind) =>
          ind % 2 === 0 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char
        )
        .join('');
    } catch {
      return decodeURIComponent(str);
    }
  },
  handler: '/scramjet/scramjet.worker.js',
  bundle: '/scramjet/scramjet.bundle.js',
  config: '/scramjet/scramjet.config.js',
  sw: '/scramjet/scramjet.sw.js',
};
