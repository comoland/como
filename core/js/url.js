class URL {
    constructor(url, base) {
      if (!url) {
        throw new TypeError('Invalid argument: url');
      }

      let parsedUrl;

      if (base) {
        parsedUrl = new URL(base);
        parsedUrl = new URL(url, parsedUrl);
      } else {
        parsedUrl = this.parseUrl(url);
      }

      this.protocol = parsedUrl.protocol;
      this.username = parsedUrl.username;
      this.password = parsedUrl.password;
      this.host = parsedUrl.host;
      this.hostname = parsedUrl.hostname;
      this.port = parsedUrl.port;
      this.pathname = parsedUrl.pathname;
      this.search = parsedUrl.search;
      this.hash = parsedUrl.hash;
    }

    parseUrl(url) {
      const regex = /^(.*?):\/\/(.*?)@?(.*?)(?::(\d+))?(\/.*?)?(?:\?(.*?))?(?:#(.*))?$/;
      const match = url.match(regex);

      if (!match) {
        throw new TypeError(`Invalid URL: ${url}`);
      }

      const [, protocol, auth, host, port, path, search, hash] = match;
      const [, username, password] = auth ? auth.split(':') : [];

      return {
        protocol: protocol.toLowerCase(),
        username: username || '',
        password: password || '',
        host: host.toLowerCase(),
        hostname: host.toLowerCase().replace(/:\d+$/, ''),
        port: port ? Number(port) : null,
        pathname: path || '/',
        search: search || '',
        hash: hash || '',
      };
    }

    toString() {
      let result = `${this.protocol}//`;

      if (this.username || this.password) {
        result += `${this.username}:${this.password}@`;
      }

      result += this.host;

      if (this.pathname) {
        result += this.pathname;
      }

      if (this.search) {
        result += this.search;
      }

      if (this.hash) {
        result += this.hash;
      }

      return result;
    }

    toJSON() {
      return this.toString();
    }
}