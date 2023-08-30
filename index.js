const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "linkup_schema",
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
  } else {
    console.log("Connected to MySQL");
  }
});

const app = express();

app.use(cors());
app.use(express.json());

app.get("/allEmployeeRecords", (req, res) => {
  const query = `
  SELECT users.fullName, users.email, users.Id, users.isAdmin, points.points
  FROM users JOIN points ON users.id = points.userId`;
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
  SELECT users.fullName, users.email, users.Id, users.isAdmin, points.points
  FROM users JOIN points ON users.id = points.userId WHERE email = ?`;

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

app.post("/signup", (req, res) => {
  try {
    const body = req.body;
    const { fullName, userName, email, password } = body;
    const query = `
    INSERT INTO users (fullName, userName, email, password, isAdmin)
    VALUES (?, ?, ?, ?, ?)`;

    connection.query(
      query,
      [fullName, userName, email, password, "false"],
      (error, userResult) => {
        if (error) {
          console.error("Error adding user:", error);
          res.status(500).send({ message: "Server error" });
        } else {
          const userId = userResult.insertId;
          const pointsQuery = `INSERT INTO Points (userId, userEmail, points) VALUES (?, ?, 0)`;

          connection.query(pointsQuery, [userId, email], (pointsError) => {
            if (pointsError) {
              console.error("Error creating points record:", pointsError);
              res.status(500).json({ message: "Server error" });
            } else {
              res.status(201).json({ message: "User signed up successfully" });
            }
          });
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
          res.status(200).send({ data: results, message: "Login successful" });
        } else {
          res.status(401).send({ message: "Invalid email or password" });
        }
      }
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.post("/addPoints", (req, res) => {
  const body = req.body;
  const { description, points: pointsToAdd, userId } = body;
  const addPointsQuery = `UPDATE points SET points = points + ? WHERE userId = ?`;
  const pointsHistoryAddQuery = `
  INSERT INTO POINTSHISTORY (userId, points, description, operationType) 
  VALUES (?, ?, ?, ?)`;

  connection.query(
    pointsHistoryAddQuery,
    [userId, pointsToAdd, description, "add"],
    (error, results) => {
      if (error) {
        console.error("Error updating points history:", error);
      } else {
        console.log("PointsHistory updated successfully");
      }
    }
  );

  connection.query(addPointsQuery, [pointsToAdd, userId], (error, results) => {
    if (error) {
      console.error("Error updating points:", error);
      res.status(500).send({ message: "Server error" });
    } else {
      console.log("Points updated successfully");
      res.status(200).json({ message: "Points added successfully" });
    }
  });
});

app.post("/removePoints", (req, res) => {
  const body = req.body;
  const { description, points: pointsToRemove, userId } = body;
  const removePointsQuery = `UPDATE points SET points = points - ? WHERE userId = ?`;
  const pointsHistoryRemoveQuery = `
  INSERT INTO POINTSHISTORY (userId, points, description, operationType) 
  VALUES (?, ?, ?, ?)`;

  connection.query(
    pointsHistoryRemoveQuery,
    [userId, pointsToRemove, description, "remove"],
    (error, results) => {
      if (error) {
        console.error("Error updating points history:", error);
      } else {
        console.log("PointsHistory updated successfully");
      }
    }
  );

  connection.query(
    removePointsQuery,
    [pointsToRemove, userId],
    (error, results) => {
      if (error) {
        console.error("Error updating points:", error);
        res.status(500).send({ message: "Server error" });
      } else {
        console.log("Points updated successfully");
        res.status(200).json({ message: "Points removed successfully" });
      }
    }
  );
});

app.listen(5000, () => {
  console.log("server started on port 5000");
});
