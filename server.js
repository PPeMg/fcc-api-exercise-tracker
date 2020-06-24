const express = require("express");
const bodyParser = require("body-parser");

const cors = require("cors");

const mongo = require("mongodb");
const mongoose = require("mongoose");
// mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' );
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true
});

const app = express();

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

/*
 * DB DEFINITION
 */
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }
});

const UserModel = mongoose.model("User", userSchema);

const activitySchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: false },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

const ActivityModel = mongoose.model("Activity", activitySchema);

/*
 * API ROUTING
 */
app.post("/api/exercise/new-user", (req, res) => {
  const username = req.body.username;

  UserModel.findOne({ username: username }, (err, doc) => {
    if (!err) {
      if (!doc) {
        UserModel.create({ username: username }, (err, doc) => {
          if (!err) {
            res.json({ _id: doc._id, username: username });
          } else {
            console.log("ERROR CREATING USER: " + err);
          }
        });
      } else {
        console.log("FOUND WITH ID " + doc.id);
        res.json({ _id: doc._id, username: username });
      }
    } else {
      console.log("ERROR SEARCHING THE USER: " + err);
    }
  });
});

app.get("/api/exercise/users", (req, res) => {
  UserModel.find({}, (err, docs) => {
    res.json(docs);
  });
});

app.post("/api/exercise/add", (req, res) => {
  const inputEmpty = input =>
    input === undefined || input === null || input.length === 0;
  const userId = req.body.userId;
  const description = req.body.description;
  const duration = req.body.duration;
  const date = req.body.date;

  if ([userId, description, duration].some(inputEmpty)) {
    res.json({ error: "There are one or more required input fields empty." });
  } else {
    UserModel.findById(userId, (err, doc) => {
      if (!err) {
        if (!doc) {
          res.json({ error: "Invalid User ID." });
        } else {
          console.log("FOUND WITH ID " + doc.id);
          let userData = { _id: doc._id, username: doc.username };

          let newActivity = {
            userId: userId,
            description: description,
            duration: duration
          };

          if (!inputEmpty(date)) {
            newActivity.date = date;
          }

          ActivityModel.create(newActivity, (err, doc) => {
            if (!err) {
              userData.description = doc.description;
              userData.duration = doc.duration;
              userData.date = doc.date.toDateString();
              res.json(userData);
            } else {
              console.log("ERROR CREATING ACTIVITY: " + err);
            }
          });
        }
      } else {
        console.log("ERROR SEARCHING THE USER: " + err);
      }
    });
  }
});

app.get("/api/exercise/log", (req, res) => {
  const userId = req.query.userId;
  const from = req.query.from;
  const to = req.query.to;
  const limit = req.query.limit;

  if (userId === undefined) {
    res.json({ error: "The userId is Undefined" });
  } else {
    UserModel.findById(userId, (err, doc) => {
      if (!err) {
        if (!doc) {
          res.json({ error: "The userId is invalid" });
        } else {
          let userData = {
            _id: doc._id,
            username: doc.username,
            log: [],
            count: 0
          };

          let activityQuery = ActivityModel.find({ userId: doc._id });

          const dateRegex = /^\d{4}\-(0?[1-9]|1[012])\-(0?[1-9]|[12][0-9]|3[01])$/g;

          console.log("FROM = " + from);
          if (from !== undefined && dateRegex.exec(from) !== null) {
            activityQuery.where("date").gte(new Date(from));
            console.log("ENTRA FROM");
          }

          console.log("TO = " + to);
          if (to !== undefined && dateRegex.exec(to) !== null) {
            activityQuery.where("date").lte(new Date(to));
            console.log("ENTRA TO");
          }

          console.log("LIMIT = " + limit);
          const limitRegex = /^\d+$/gm;
          if (limit !== undefined && limitRegex.exec(limit) !== null) {
            activityQuery.limit(parseInt(limit));
            console.log("ENTRA LIMIT");
          }

          activityQuery.exec((err, doc) => {
            userData.count = doc.length;
            doc.forEach(element =>
              userData.log.push({
                _id: element._id,
                description: element.description,
                duration: element.duration,
                date: element.date.toDateString()
              })
            );
            res.json(userData);
          });
        }
      } else {
        res.json({ error: "The userId is invalid" });
        console.log("ERROR CREATING ACTIVITY: " + err);
      }
    });
  }
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
