//RUN IN TERMINAL SAYING 'nodemon index.js'
import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = 3000;
const app = express();
let postCounter = 1;

//communities container
const communities =["Business", "Fitness", "Technology", "Music", "Sports", "Food"];

//recent container
const recents = [];

// File paths
const postsFilePath = path.join(__dirname, 'data', 'posts.json');
const usersFilePath = path.join(__dirname, 'data', 'users.json');

// Ensure data directory and files exist
const ensureDataFile = (filePath) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]');
    }
};

ensureDataFile(postsFilePath);
ensureDataFile(usersFilePath);

// Load existing data
let posts = JSON.parse(fs.readFileSync(postsFilePath));
let users = JSON.parse(fs.readFileSync(usersFilePath));
postCounter = posts.length ? posts[posts.length - 1].post_id + 1 : 1;

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
// Set EJS as the default templating engine
app.set('view engine', 'ejs');

// Session configuration
app.use(session({
    secret: 'your_secret_key', // Replace with a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 86400000 } // Set secure to true in production with HTTPS
}));

// Middleware to log session and request details
app.use((req, res, next) => {
    console.log("Request URL:", req.url);
    console.log("Session data:", req.session);
    next();
});


// Function to add user
function addUser(name, pw) {
    users.push({ username: name, password: pw });
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

// Function to find user
function findUser(name, pw) {
    return users.find(user => user.username === name && user.password === pw);
}

// Function to add post
function addPost(username, community, title, body, date) {
    const newPost = { post_id: postCounter++, username, community, title, body, date };
    posts.push(newPost);
    fs.writeFileSync(postsFilePath, JSON.stringify(posts, null, 2));
}

// Function checking if user is authenticated/logged in
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        console.log("User is authenticated:", req.session.user.username);
        next();
    } else {
        console.log("User not authenticated, redirecting to login");
        req.session.redirectTo = req.originalUrl; // Save the requested URL
        res.redirect('/login'); // Redirect to login if not authenticated
    }
}

// Home page
app.get("/", (req, res) => {
    console.log("Home page accessed. Session:", req.session);
    res.render("index.ejs", { posts: posts , recents: recents});
});

// Profile page
app.get("/profile", isAuthenticated, (req, res) => {
    const user = req.session.user;
    console.log("Profile page accessed by user:", user.username);
    res.render("profile.ejs", { username: user.username, posts: posts });
});

// New post page
app.get("/new_post", isAuthenticated, (req, res) => {
    res.render("new_post.ejs", {
        communities: communities
    });
});

// Login page
app.get("/login", (req, res) => {
    res.render("login.ejs");
});

// Register page
app.get("/register", (req, res) => {
    res.render("register.ejs");
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log("Error destroying session: ", err);
            return res.status(500).send("Failed to logout");
        }
        recents.length = 0;
        res.clearCookie('connect.sid', { path: '/' }); // Ensure the session cookie is cleared
        res.redirect('/');
    });
});

// Specific post page
app.get("/post/:id", (req, res) => {
    const post = posts.find(p => p.post_id === parseInt(req.params.id));
    if (post) {
        res.render("post.ejs", { post: post });
        if(recents.includes(post)){

        }
        else{
            recents.push(post);
        }

    } else {
        res.status(404).send("Post not found");
    }
});

// Messages page
app.get("/messages", isAuthenticated, (req, res) => {
    res.render("messages.ejs");
});

// Edit post page
app.get("/edit/:id", isAuthenticated, (req, res) => {
    const post = posts.find(p => p.post_id === parseInt(req.params.id) && p.username === req.session.user.username);
    if (post) {
        res.render("edit_post.ejs", { post: post });
    } else {
        res.status(404).send("Post not found");
    }
});

//Communities page
app.get("/communities", (req,res) => {
    res.render("communities.ejs", {
        communities: communities
    });
});

//Community pages
app.get("/communities/:community", (req, res) => {
    const requestedCommunity = req.params.community;
    if(requestedCommunity){
        res.render(`communities/${requestedCommunity}`,
            {posts:posts}
        );
    }
    else{
        res.render(404).send("Community doesnt exist");
    }
});

// Submit post
app.post("/submit", isAuthenticated, (req, res) => {
    const username = req.session.user.username;
    const community = req.body.community;
    const title = req.body.title;
    const body = req.body.body;
    const date = Date.now();

    console.log(`User ${username} is submitting a post`);
    addPost(username, community, title, body, date);
    console.log("Post submitted successfully");
    res.redirect("/");
});

// Delete post
app.post("/delete/:id", isAuthenticated, (req, res) => {
    const postId = parseInt(req.params.id);
    const postIndex = posts.findIndex(p => p.post_id === postId && p.username === req.session.user.username);
    if (postIndex !== -1) {
        posts.splice(postIndex, 1);
        fs.writeFileSync(postsFilePath, JSON.stringify(posts, null, 2));
        console.log(`Post with ID ${postId} deleted successfully`);
    }
    res.redirect("/profile");
});

// Edit post
app.post("/edit/:id", isAuthenticated, (req, res) => {
    const postId = parseInt(req.params.id);
    const post = posts.find(p => p.post_id === postId && p.username === req.session.user.username);
    if (post) {
        post.title = req.body.title;
        post.body = req.body.body;
        fs.writeFileSync(postsFilePath, JSON.stringify(posts, null, 2));
        console.log(`Post with ID ${postId} edited successfully`);
        res.redirect("/");
    } else {
        res.status(404).send("Post not found");
    }
});

// Register user
app.post("/register", (req, res) => {
    addUser(req.body.username, req.body.password);
    res.redirect("/login");
});

// Login user
app.post("/login", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const user = findUser(username, password);
    if (user) {
        req.session.user = user; // Set the user in session
        console.log(`User ${username} logged in successfully`);
        console.log("Session data after login:", req.session);
        const redirectTo = req.session.redirectTo || '/profile';
        delete req.session.redirectTo; // Remove redirectTo from session
        res.redirect(redirectTo);
    } else {
        console.log("Invalid login attempt");
        res.redirect("/login");
    }
});



// Active port
app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});
