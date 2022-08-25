const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');
const { result, get } = require('lodash');

const app = express();

const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "1234",
    database: 'newDBProject'
  });
  
con.connect(function(err) {
    if (err) {throw err;}
    else {console.log("Connected!");}
});

app.listen(3000);

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

app.set('view engine', 'ejs');

app.get('/', (req,res) => {
    res.redirect('/movies');
});

app.get('/logout', (req,res) => {
    req.session.log = false;
    req.session.username = null;
    req.session.user = null;
    res.redirect('movies');
})

app.get('/login', (req, res) => {
    res.render('login', {msg: ' '});
});

app.get('/login/nosuchuser', (req, res) => {
    res.render('login', {msg: 'there is no user with that id or password'});
});

app.post('/auth', (req, res) => {
    const username = req.body.username;
	const password = req.body.password;
    if (username && password) {
		con.query('SELECT * FROM users WHERE username = ? AND userPassword = ?', 
        [username, password], 
        (err, results, fields) => {
            if (results.length > 0) {
                req.session.log = true;
                req.session.username = username;
                req.session.user = results[0];
                res.redirect('/movies');
            }
            else {
				res.redirect('/login/nosuchuser');
			}
        })
    }
});

app.get('/signup', (req, res) => {
    res.render('signup', {msg: ' '});
});

app.get('/signup/userexists', (req, res) => {
    res.render('signup', {msg: 'user with that username already exists'});
});

app.get('/signup/passwordsdontmatch', (req, res) => {
    res.render('signup', {msg: 'password doesnt match'});
})

app.post('/addNewUser', (req, res) => {
    const username = req.body.username;
	const password = req.body.password;
    const rePassword = req.body.rePassword;

    if(password == rePassword) {
        con.query('SELECT * FROM users WHERE username = ?', [username], (err, results, fields) => {
            if(results.length == 0){
                con.query('INSERT INTO users (username, userPassword) VALUES (?,?)', 
                [username, password], 
                (err1, results1, fields1) => {
                    if(err1) throw err1;
                    res.redirect('movies');
                })
            }
            else {
                res.redirect('signup/userexists');
            }
        })
    }
    else {
        res.redirect('signup/passwordsdontmatch');
    }
})

app.get('/movies', async (req,res) => {
    const allMoviesQueryResult = allMoviesQuery();

    var allMoviesResult;

    const promises = [allMoviesQueryResult];
    try {
        const result = await Promise.all(promises);
        allMoviesResult = result[0];
    } catch (error){
        console.log(error);
    }

    if(req.session.log) {
        res.render('index', { movies: allMoviesResult, loggedIn: req.session.log, user: req.session.username, 
            userType: req.session.user.userType });
    }
    else {
        res.render('index', { movies: allMoviesResult, loggedIn: req.session.log, user: req.session.username }) 
    }
});

allMoviesQuery = () => {
    return new Promise((resolve, reject) => {
        var queryStr = "select m.deleteOrNotDelete as deleteOrNotDelete, m.movieID as movieID, round(avg(r.rating),1)\
        as averageRating, m.movieName as movieName, m.posters as posters from ratings r inner join\
        users u on u.username = r.userWhoHasRated right outer join movies m on m.movieID = r.movieThatIsBeingRated\
        where u.userType != 'BANNED' or u.userType is NULL group by m.movieID;";
        con.query(queryStr, (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};

app.get('/movies/search', async (req, res) => {

    const movieName = req.query.movieName;
    const searchMoviesQueryResult = searchMoviesQuery(movieName);

    var searchMoviesResult;

    const promises = [searchMoviesQueryResult];
    try {
        const result = await Promise.all(promises);
        searchMoviesResult = result[0];
    } catch (error){
        console.log(error);
    }

    if(req.session.log) {
        res.render('index', { movies: searchMoviesResult, loggedIn: req.session.log, user: req.session.username, 
            userType: req.session.user.userType});
    }
    else {
        res.render('index', { movies: searchMoviesResult, loggedIn: req.session.log, user: req.session.username });
    }
});

searchMoviesQuery = (movieName) => {
    return new Promise((resolve, reject) => {
        var queryStr = "select  m.deleteOrNotDelete as deleteOrNotDelete, m.movieID as movieID, round(avg(r.rating),1)\
        as averageRating, m.movieName as movieName, m.posters as posters from ratings r inner join\
        users u on u.username = r.userWhoHasRated right outer join movies m on m.movieID = r.movieThatIsBeingRated\
        where (u.userType != 'BANNED' or u.userType is NULL) and  movieName like '%" + movieName + "%' group by m.movieID;";
        con.query(queryStr, (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};


//movieDetails
app.get('/movies/:movieId', async (req, res) => {
    const movieId = req.params.movieId;
    const msg = req.query.valid;

    const movieQueryResult = movieQuery(movieId);
    const reviewQueryResult = reviewQuery(movieId);
    const averageQueryResult = averageRatingQuery(movieId);
    const trailerQueryResult = trailerQuery(movieId);
    const moviecastResult = moviecastQuery(movieId); 

    

    var movieResult;
    var reviewResult;
    var averageRatingResult;
    var trailerResult;
    var castResult;
    const promises = [movieQueryResult, reviewQueryResult, averageQueryResult, trailerQueryResult, moviecastResult];
    try {
        const result = await Promise.all(promises);
        averageRatingResult = result[2][0].averageRating;
        reviewResult = result[1];
        movieResult = result[0][0];
        trailerResult = result[3];
        castResult = result[4]; 
    } catch (error){
        console.log(error);
    }
    if(req.session.log) {
        
        const likesQueryResult = likesQuery(req.session.username);
        const myRatingQueryResult = myRatingQuery(req.session.username, movieId);
        const promisesForWhenUserLoggedIn = [likesQueryResult, myRatingQueryResult];

        var likesResult;
        var myRatingResult;
        try {
            const resultForWhenUserLoggedIn = await Promise.all(promisesForWhenUserLoggedIn);
            likesResult = resultForWhenUserLoggedIn[0];
            myRatingResult = resultForWhenUserLoggedIn[1];
        } catch (error){
            console.log(error);
        }
        likesArr = [];
        for (let i = 0; i < likesResult.length; i++) {
            likesArr.push(likesResult[i].reviewID);
        }
        
        var value;
        if(myRatingResult.length > 0) {
            value = myRatingResult[0].rating;
        }
        else {
            value = "Your rating will be displayed here if you ever add one";
        }
        res.render('movieDetails' , {casts: castResult, trailers: trailerResult, avgRating: averageRatingResult,
        likes: likesArr,  movie: movieResult , 
        loggedIn: req.session.log, user: req.session.username,
        userType: req.session.user.userType,
        reviews: reviewResult, errMsg: msg, yourRating: value} );
    }
    else {
        res.render('movieDetails' , {casts: castResult, trailers: trailerResult, avgRating: averageRatingResult, movie: movieResult , 
        loggedIn: req.session.log, user: req.session.username,
        reviews: reviewResult, errMsg: msg} );
    }
});

moviecastQuery = (movieId)=>{
    return new Promise((resolve, reject)=>{
        con.query("select a.actorName from actors a join movie_cast\
         m on a.actorID = m.actor_ID where m.actedinMovie=?;" ,[movieId],(err, results)=>{
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        });
    });
};

trailerQuery = (movieId) => {
    return new Promise((resolve, reject) => {
        var queryStr = "select * from trailers where movieItsTrailerOf = ?";
        con.query(queryStr, [movieId], (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};

myRatingQuery = (username, movieId) => {
    return new Promise((resolve, reject) => {
        var queryStr = "select * from ratings where userWhoHasRated = ? \
        and movieThatIsBeingRated = ?;";
        con.query(queryStr, [username, movieId], (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};


likesQuery = (username) => {
    return new Promise((resolve, reject) => {
        var queryStr = "select reviewID from likes where userWhoWroteLiked = ?;";
        con.query(queryStr, [username], (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};

averageRatingQuery = (movieId) => {
    return new Promise((resolve, reject) => {
        var queryStr = "select round(avg(rating),1) as averageRating from ratings\
        r inner join users u on u.username = r.userWhoHasRated\
        where movieThatIsBeingRated = ?  and u.userType != 'BANNED';";
        con.query(queryStr, [movieId], (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};

movieQuery = (movieId) => {
    return new Promise((resolve, reject) => {

        var queryStr = "select deleteOrNotDelete, movieID, movieName, movieSummary, posters,\ DATE_FORMAT(releaseDate, '%d-%b-%y')\
         as releaseDate\
        from movies where movieID = ?;";
        con.query(queryStr , [movieId], (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};


reviewQuery = (movieId) => {
    return new Promise((resolve, reject) => {
        var queryStr = "select r.reviewID as revID, count(userWhoWroteLiked) as likeCount,\
        r.review as theReview, r.userWhoWroteReview as reviewAuthor,\ u.userType as isUserBannedOrNot,\
        DATE_FORMAT(r.whenCommentWasWritten, '%d-%b-%y, Time: %H-%i-%s')\
        as dateWritten  from likes l right join reviews r on l.reviewID = r.reviewID\ inner join users u on\
        u.username = r.userWhoWroteReview\
        where r.theMovieItIsReviewOf = ?\
        group by r.reviewID order by r.whenCommentWasWritten desc;"
        con.query(queryStr, [movieId], (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};


app.post('/insertReview/:movieID/:username', (req, res) =>{
    const movieID = req.params.movieID;
    const username = req.params.username;
    const review = req.body.review;

    var queryStr = "insert into reviews (review, userWhoWroteReview, theMovieItIsReviewOf) values (?, ?, ?)"

    if(req.session.log) {
        con.query(queryStr, [review, username, movieID], (err, result) => {
            if(err) throw err;
            res.redirect('/movies/' + movieID);
        })
    }
    else {
        res.redirect('/movies/' + movieID + '/?valid=no one logged in');
    }
} );

app.post('/addLike/:username/:reviewID/:movieID', (req, res) => {
    const username = req.params.username;
    const reviewID = req.params.reviewID;
    const movieID = req.params.movieID;

    var queryStr = "insert into likes (reviewID, userWhoWroteLiked) values (?, ?);";

    con.query(queryStr, [reviewID, username], (err, result) => {
        if(err) throw err;
        res.redirect('/movies/' + movieID);
    })
});

app.post('/deleteLike/:username/:reviewID/:movieID', (req, res) => {
    const username = req.params.username;
    const reviewID = req.params.reviewID;
    const movieID = req.params.movieID;

    var queryStr = "delete from likes where reviewID = ? and userWhoWroteLiked = ?;";

    con.query(queryStr, [reviewID, username], (err, result) => {
        if(err) throw err;
        res.redirect('/movies/' + movieID);
    })
});

app.post('/addOrUpdateReview/:username/:movieID', (req, res) => {
    const username = req.params.username;
    const movieID = req.params.movieID;
    const rating = req.body.rating;

    const queryStr = "select * from ratings where userWhoHasRated = ? and movieThatIsBeingRated = ?";

    con.query(queryStr, [username, movieID], (err, result) => {
        if(err) throw err;
        if(result.length == 0) {
            const insertQuery = "insert into ratings (userWhoHasRated, movieThatIsBeingRated, rating)\
            values(?, ?, ?);";

            if(rating == 0) {
                res.redirect('/movies/' + movieID );
            }
            else {
                con.query(insertQuery, [username, movieID, rating], (err1, result1) => {
                    if(err1) throw err1;
                    res.redirect('/movies/' + movieID );
                });
            }
        }

        else {
            if (rating == 0) {
                const deleteQuery = "delete from ratings where userWhoHasRated = ?\
                and movieThatIsBeingRated = ?;";
                con.query(deleteQuery, [username, movieID], (err1, result1) => {
                    if(err1) throw err1;
                    res.redirect('/movies/' + movieID);
                })
            } else {
                const updateQuery = "update ratings set rating = ? where userWhoHasRated = ?\
                and movieThatIsBeingRated = ?;";

                con.query(updateQuery, [rating, username, movieID], (err1, result1) => {
                    if(err1) throw err1;
                    res.redirect('/movies/' + movieID);
                });
            }
        }
    })
});


app.post('/banUser/:username/:movieID', (req, res) => {
    const username = req.params.username;
    const movieID = req.params.movieID;

    const queryStr = "update users set userType = 'BANNED' where username = ?;";

    con.query(queryStr, [username], (err, result) => {
        if(err) throw err;
        res.redirect('/movies/' + movieID);
    });
});

app.post('/unBanUser/:username/:movieID', (req, res) => {
    const username = req.params.username;
    const movieID = req.params.movieID;

    const queryStr = "update users set userType = 'ACTIVE' where username = ?;";

    con.query(queryStr, [username], (err, result) => {
        if(err) throw err;
        res.redirect('/movies/' + movieID);
    });
});

app.get('/addMovie', (req, res) => {
    res.render('addMovieForm');
});

app.post('/addMovie', async (req, res) => {
    const movieName = req.body.movieName;
    const movieSummary = req.body.movieSummary;
    const poster = req.body.moviePoster;
    const releaseDate = req.body.releaseDate;

    const insertIdQueryResult = insertPromise(movieName, movieSummary, poster, releaseDate);
    const insertPromises = [insertIdQueryResult];

    var insertResult;
    try {
        const result = await Promise.all(insertPromises);
        insertResult = result[0];
    } catch (error){
        console.log(error);
    }

    res.redirect('/movies');
});

insertPromise = (movieName, movieSummary, poster, releaseDate) => {
    return new Promise((resolve, reject) => {
        var queryStr = "insert into movies ( movieName, movieSummary, posters, releaseDate)\
         values (?, ?, ?, ?);";
        con.query(queryStr, [ movieName, movieSummary, poster, releaseDate ], (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};

app.post("/deleteMovie/:movieID", async (req, res) => {
    const movieID = req.params.movieID;
    const action = req.body.action;

    const deleteOrUnDeleteQueryResult = deleteOrUnDeletePromise(movieID, action);

    var deleteOrUnDeleteResult;
    const promises = [deleteOrUnDeleteQueryResult];
    try {
        const result = await Promise.all(promises);
        deleteOrUnDeleteResult = result[0];
    } catch (error){
        console.log(error);
    }

    res.redirect('/movies/' + movieID);
});

deleteOrUnDeletePromise = (movieID, action) => {
    return new Promise((resolve, reject) => {
        var queryStr = "update movies set deleteOrNotDelete = ? where movieID = ?;"
        con.query(queryStr, [ action, movieID ], (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};

app.get("/editMovieInfo/:movieID", async (req, res) => {
    const movieID = req.params.movieID;
    const getMovieQueryResult = getMovieQuery(movieID);

    var getMovieResult;
    const promises = [getMovieQueryResult];
    try {
        const result = await Promise.all(promises);
        getMovieResult = result[0];
    } catch (error){
        console.log(error);
    }
    res.render('editMovieForm', {movieToEdit: getMovieResult[0]} );
});

getMovieQuery = (movieID) => {
    return new Promise((resolve, reject) => {
        var queryStr = "select DATE_FORMAT(releaseDate, '%Y-%m-%d') as releaseDate, movieID, movieName,\
        movieSummary, posters from movies where movieID=?;"
        con.query(queryStr, [ movieID ], (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};

app.post("/updateMovie", async (req, res) => {
    const releaseDate = req.body.releaseDate;
    const movieID = req.body.movieID;
    const movieName = req.body.movieName;
    const movieSummary = req.body.movieSummary;
    const posters = req.body.moviePoster;   

    const updateMovieQueryResult = updateMovieQuery(releaseDate, movieID, movieName, movieSummary, posters);

    var updateMovieResult;
    const promises = [updateMovieQueryResult];
    try {
        const result = await Promise.all(promises);
        updateMovieResult = result[0];
    } catch (error){
        console.log(error);
    }
    res.redirect('/movies/' + movieID);
});

updateMovieQuery = (releaseDate, movieID, movieName, movieSummary, posters) => {
    return new Promise((resolve, reject) => {
        var queryStr = "update movies set releaseDate = ?, movieName = ?,\
        movieSummary = ?, posters = ? where movieID=?;"
        con.query(queryStr, [ releaseDate, movieName, movieSummary, posters, movieID ], (err, results) => {
            if(err){
                return reject(err);
            }
            else{
                return resolve(results);
            }
        }); 
    });
};