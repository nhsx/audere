// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

"use strict";

const { baseColumns, column, unique } = require("../../util");
const schema = "cough";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      "import_problems",
      {
        ...baseColumns(Sequelize),
        firebase_id: column(Sequelize.STRING),
        firebase_collection: column(Sequelize.STRING),
        attempts: column(Sequelize.INTEGER),
        last_error: column(Sequelize.TEXT)
      },
      { schema }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("import_problems", { schema });
  }
};
