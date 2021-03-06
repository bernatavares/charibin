'use strict';

const { Valid, TicketService } = require('../../services');

module.exports = app => {
  app.get('/dashboard/ticket/:page/:limit/:priceStart/:priceEnd/:dateStart/:dateEnd/:adult/:youth/:departure/:timezone', ({ params, token: { role } }, res) => {
    Valid.onCreate(params, 'TicketCriteria', role)
      .then(data =>TicketService.findDashboard(data))
      .then(res.ok)
      .catch(res.error);
  });
};
