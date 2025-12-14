const {DataTypes} = require("sequelize")
const {sequelize} = require("../config/db.config");
const { Alert } = require("./alerts");
const { Measurement } = require("./measurements");
// const { HealthHistory } = require("./health_history"); // Remove circular import


  const Worker = sequelize.define(
    "Worker",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      // Legacy single name field (for backward compatibility)
      name: { type: DataTypes.STRING, allowNull: true },
      // New separate name fields
      fname: { type: DataTypes.STRING, allowNull: true },
      lname: { type: DataTypes.STRING, allowNull: true },
      gender: { type: DataTypes.ENUM("male", "female"), allowNull: true },
      // Legacy height/weight fields (for backward compatibility)
      height: { type: DataTypes.FLOAT, allowNull: true },
      weight: { type: DataTypes.FLOAT, allowNull: true },
      // New metric fields
      height_m: { type: DataTypes.FLOAT, allowNull: true },
      weight_kg: { type: DataTypes.FLOAT, allowNull: true },
      bmi: { type: DataTypes.FLOAT, allowNull: true },
      age: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: "workers",
      timestamps: true,
    }
  );

module.exports = {
    Worker,
    sequelize
}
