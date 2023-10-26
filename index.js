const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");

let connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'linkup_schema',
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL');
  }
});

connection.on('error', (err) => {
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Reconnecting to MySQL...');

    connection = mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root',
      database: 'linkup_schema',
    });

    connection.connect((connectErr) => {
      if (connectErr) {
        console.error('Error reconnecting to MySQL:', connectErr);
      } else {
        console.log('Reconnected to MySQL');
      }
    });
  } else {
    console.error('MySQL connection error:', err);
  }
});

const app = express();

app.use(cors());
app.use(express.json());

app.get("/allEmployeeRecords", (req, res) => {
  const query = `
  SELECT users.employeeId, users.fullName, users.email, users.isAdmin, points.rewardPoints
  FROM users JOIN points ON users.employeeId = points.employeeId`;
  connection.query(query, (error, userResult) => {
    if (error) {
      console.error("Error querying users:", error);
      res.status(500).send({ message: "Server error" });
    } else {
      res
        .status(200)
        .json({ data: userResult, message: "Users queried successfully" });
    }
  });
});

app.get("/employeeRecord", (req, res) => {
  const { email } = req.query;
  const query = `
  SELECT users.employeeId, users.fullName, users.email, users.isAdmin, points.rewardPoints
  FROM users JOIN points ON users.employeeId = points.employeeId WHERE users.email = ?`;

  connection.query(query, [email], (error, userResult) => {
    if (error) {
      console.error("Error querying users:", error);
      res.status(500).send({ message: "Server error" });
    } else {
      res
        .status(200)
        .json({ data: userResult[0], message: "Users queried successfully" });
    }
  });
});

app.get("/points", (req, res) => {
  const { employeeId } = req.query;
  const query = `SELECT rewardPoints from points where employeeId = ?`;

  connection.query(query, [employeeId], (error, result) => {
    if (error) {
      console.error("Error querying points:", error);
      res.status(500).send({ message: "Server error" });
    } else {
      res.status(200).json({
        data: result[0]?.rewardPoints,
        message: "Points queried successfully",
      });
    }
  });
});

app.get("/pointsHistory", (req, res) => {
  const { employeeId } = req.query;
  const query = `SELECT * from pointshistory where employeeId = ?`;

  connection.query(query, [employeeId], (error, result) => {
    if (error) {
      console.error("Error querying pointsHistory:", error);
      res.status(500).send({ message: "Server error" });
    } else {
      res
        .status(200)
        .json({ data: result, message: "PointsHistory queried successfully" });
    }
  });
});

app.post("/signup", (req, res) => {
  try {
    const body = req.body;
    const { fullName, email, password, employeeId } = body;
    const query = `
    INSERT INTO users (fullName, email, password, isAdmin, employeeId, status)
    VALUES (?, ?, ?, ?, ?, ?)`;

    connection.query(
      query,
      [fullName, email, password, "false", employeeId, "Active"],
      (error, userResult) => {
        if (error) {
          console.error("Error adding user:", error);
          res.status(500).send({ message: "Server error" });
        } else {
          const pointsQuery = `INSERT INTO Points (employeeId, fullName, email, rewardPoints) VALUES (?, ?, ?, 0)`;

          connection.query(
            pointsQuery,
            [employeeId, fullName, email],
            (pointsError) => {
              if (pointsError) {
                console.error("Error creating points record:", pointsError);
                const deleteQuery = `DELETE from users where employeeId = ?`;
                connection.query(deleteQuery, [employeeId], () => {});
                res.status(500).json({ message: "Server error" });
              } else {
                res
                  .status(201)
                  .json({ message: "User signed up successfully" });
              }
            }
          );
        }
      }
    );
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.post("/login", (req, res) => {
  try {
    const body = req.body;
    const { email, password } = body;
    const query = `SELECT * from users WHERE email = ? and password = ?`;

    connection.query(query, [email, password], (error, results) => {
      if (error) {
        console.error("Error querying database:", error);
        res.status(500).send({ message: "Server error" });
      } else {
        if (results.length > 0) {
          const token = jwt.sign({ userId: results[0].employeeId }, "secret");
          const userData = results[0];
          delete userData.password;
          res.status(200).send({ user: userData, token });
        } else {
          res.status(401).send({ message: "Invalid email or password" });
        }
      }
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.post("/resetPassword", (req, res) => {
  try {
    const body = req.body;
    const { email, oldPassword, newPassword } = body;

    const query = `SELECT users.password from users WHERE email = ?`;

    connection.query(query, [email], (error, userResult) => {
      if (error) {
        console.error("Error changing password:", error);
        res.status(500).send({ message: "Server error" });
      } else {
        if (oldPassword !== userResult[0].password) {
          res.status(500).send({ message: "Enter Correct Old Password" });
        } else {
          const updateQuery = `UPDATE users SET password = ? WHERE email = ?`;

          connection.query(
            updateQuery,
            [newPassword, email],
            (error, userResult) => {
              if (error) {
                console.error("Error changing password:", error);
                res.status(500).send({ message: "Server error" });
              } else {
                res
                  .status(200)
                  .send({ message: "Password changed successfully" });
              }
            }
          );
        }
      }
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.post("/addPoints", (req, res) => {
  const body = req.body;
  const { description, points: pointsToAdd, employeeId, createdByUser } = body;
  const addPointsQuery = `UPDATE points SET rewardPoints = rewardPoints + ? WHERE employeeId = ?`;
  const pointsHistoryAddQuery = `
  INSERT INTO POINTSHISTORY (employeeId, points, description, operationType, createdByUser) 
  VALUES (?, ?, ?, ?, ?)`;

  connection.query(
    pointsHistoryAddQuery,
    [employeeId, pointsToAdd, description, "add", createdByUser],
    (error, userResult) => {
      const pointsHistoryId = userResult.insertId;
      if (error) {
        console.error("Error updating points history:", error);
        res.status(500).send({ message: "Server error" });
      } else {
        connection.query(
          addPointsQuery,
          [pointsToAdd, employeeId],
          (error, results) => {
            if (error) {
              console.error("Error updating points:", error);
              const deleteQuery = `DELETE from pointshistory where Id = ?`;
              connection.query(deleteQuery, [pointsHistoryId], () => {});
              res.status(500).send({ message: "Server error" });
            } else {
              console.log("Points updated successfully");
              res.status(200).json({ message: "Points added successfully" });
            }
          }
        );
      }
    }
  );
});

app.post("/removePoints", (req, res) => {
  const body = req.body;
  const {
    description,
    points: pointsToRemove,
    employeeId,
    createdByUser,
  } = body;
  const removePointsQuery = `UPDATE points SET rewardPoints = rewardPoints - ? WHERE employeeId = ?`;
  const pointsHistoryRemoveQuery = `
  INSERT INTO POINTSHISTORY (employeeId, points, description, operationType, createdByUser) 
  VALUES (?, ?, ?, ?, ?)`;

  connection.query(
    pointsHistoryRemoveQuery,
    [employeeId, pointsToRemove, description, "remove", createdByUser],
    (error, userResult) => {
      const pointsHistoryId = userResult.insertId;
      if (error) {
        console.error("Error updating points:", error);
        res.status(500).send({ message: "Server error" });
      } else {
        connection.query(
          removePointsQuery,
          [pointsToRemove, employeeId],
          (error, results) => {
            if (error) {
              console.error("Error updating points:", error);
              const deleteQuery = `DELETE from pointshistory where Id = ?`;
              connection.query(deleteQuery, [pointsHistoryId], () => {});
              res.status(500).send({ message: "Server error" });
            } else {
              console.log("Points updated successfully");
              res.status(200).json({ message: "Points removed successfully" });
            }
          }
        );
      }
    }
  );
});

app.listen(5000, () => {
  console.log("server started on port 5000");
});
