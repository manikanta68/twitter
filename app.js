const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 1
app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}'
        )`;
      const dbResponse = await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

// API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      console.log({ jwtToken });
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const userIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(userIdQuery);
  console.log(userId.user_id);
  const selectQuery = `SELECT name,tweet,date_time AS dateTime FROM (follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id) AS T INNER JOIN user ON T.user_id=user.user_id WHERE tweet.user_id=${userId.user_id} ORDER BY date_time DESC LIMIT 4 OFFSET 0;`;
  const tweetList = await db.all(selectQuery);
  response.send(tweetList);
});

// API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(selectQuery);
  console.log(userId.user_id);
  const followingQuery = `SELECT name FROM user INNER JOIN follower ON user.user_id=follower.following_user_id WHERE following_user_id=${userId.user_id};`;
  const following = await db.all(followingQuery);
  response.send(following);
});

// API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(selectQuery);
  const followersQuery = `SELECT follower_user_id FROM follower WHERE follower_id=${userId};`;
  const followedId = await db.get(followersQuery.user_id);
  console.log(followedId);
  const followers = await db.all(followedId);
  response.send(followers);
});

// API 6
app.get(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {}
);

// API 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {}
);

// API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {}
);

// API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(selectQuery);
  const tweets = `SELECT tweet,SUM(like_id) AS likes,SUM(reply_id) AS replies,date_time AS dateTime FROM (tweet INNER JOIN reply ON tweet.user_id=reply.user_id) AS T INNER JOIN like ON T.user_id=like.user_id WHERE T.user_id=${userId.user_id};`;
  const tweetList = await db.all(tweets);
  response.send(tweetList);
});

// API 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
  const tweetQuery = `INSERT INTO tweet (tweet) VALUES ('${tweet}');`;
  await db.run(tweetQuery);
  response.send("Created a Tweet");
});

// API 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const selectUserId = `SELECT user_id FROM user WHERE username='${username}';`;
    const loginUser = await db.get(selectUserId);
    const selectTweetUserId = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId}; `;
    const tweetUserId = await db.get(selectTweetUserId);
    console.log(loginUser.user_id, tweetUserId.user_id);
    if (loginUser.user_id !== tweetUserId.user_id) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const requestQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId};`;
      await db.run(requestQuery);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
