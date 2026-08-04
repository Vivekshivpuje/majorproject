if(process.env.NODE_ENV != "production"){
  require("dotenv").config();
}
// console.log(process.env.SECRET);
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

 const dbUrl = process.env.ATLASDB_URL;

main()
 .then(() =>  {
    console.log("connected to DB");
 })
 .catch((err) => {
    console.log(err);
 });

async function main() {
    await mongoose.connect(dbUrl);
}
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

  const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 3600,
    collectionName: "sessions",
    serialize: (session) => JSON.stringify(session),
    unserialize: (data) => {
      // connect-mongo v4 stores sessions as JSON strings, but the DB may contain
      // legacy / corrupted records (e.g. base64 or binary data). Decode safely.
      let raw = data;
      if (raw instanceof Buffer) {
        raw = raw.toString("utf8");
      }
      if (typeof raw === "string" && !raw.trim().startsWith("{")) {
        try {
          const decoded = Buffer.from(raw.trim(), "base64").toString("utf8");
          if (decoded.trim().startsWith("{")) {
            raw = decoded;
          }
        } catch (e) {
          /* not base64 — ignore */
        }
      }
      try {
        return JSON.parse(raw);
      } catch (e) {
        // Corrupt / incompatible session record. Return a fresh, valid session
        // object (must include a cookie) so express-session doesn't crash.
        return {
          cookie: {
            originalMaxAge: 7 * 24 * 60 * 60 * 1000,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            httpOnly: true,
            path: "/",
          },
        };
      }
    },
  });
store.on("error", (err) => {
    console.log("SESSION STORE ERROR", err);
  });
 const sessionOptions = {
   store,
   secret: process.env.SECRET,
   resave: false, 
   saveUninitialized: true,
   cookie: {               //days hours 
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    },
  };
  //  app.get("/", (req, res) => {
  //  res.send("Hi, I am root");
  //  });

   app.use(session(sessionOptions));
   app.use(flash());

   app.use(passport.initialize());
   app.use(passport.session());
   passport.use(new LocalStrategy(User.authenticate()));
   
   passport.serializeUser(User.serializeUser());
   passport.deserializeUser(User.deserializeUser());
   
   
   app.use((req, res, next) => {
     res.locals.success = req.flash("success");
     res.locals.error = req.flash("error");
     res.locals.currUser = req.user;
     next();
   });

    app.use("/listings", listingRouter);
    app.use("/listings/:id/reviews", reviewRouter);
    app.use("/",userRouter);

    app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
    });
    app.use((err, req, res, next) => {
     let {statusCode=500, message="Something went wrong"} = err;

     if(statusCode !== 404) {
       console.log(err);
     }
      res.status(statusCode).render("error.ejs", { message });
       //   res.status(statusCode).send(message);
    });

    app.listen(8080, () => {
     console.log("server is listening to port 8080");
    });






