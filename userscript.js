// ==UserScript==
// @name         Google Calendar Scraper
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://calendar.google.com/calendar/u/1*
// @match.       https://mail.google.com/mail/u/1*
// @icon         https://www.google.com/s2/favicons?domain=tampermonkey.net
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/axios/0.21.1/axios.min.js
// ==/UserScript==

(function () {
  'use strict';

  function getEvents() {
    const id = 'YW1jb2xhc2hAc2FsZXNmb3JjZS5jb20';
    const url = `https://calendar.google.com/calendar/u/1/exporticalzip?cexp=${id}`;

    const server = 'http://amcolash.com:8002/cal';

    // Grab an export of calendar from gmail
    axios
      .get(url)
      .then((response) => {
        console.log(response);

        // Turn it into a blob
        const blob = new Blob([JSON.stringify(response.data)], { type: 'application/zip' });
        console.log(blob);

        // Send it to the server to update the hosted calendar
        axios.post(server, response.data, { headers: { 'content-type': 'application/zip' } });
      })
      .catch((err) => {
        console.error(err);
      });
  }

  // Run this every 5 minutes while the tab is open
  const timeout = 5 * 60 * 1000;
  setInterval(timeout, getEvents);

  // Get events immediately
  getEvents();
})();
