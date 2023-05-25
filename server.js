// 필요한 패키지 import
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const sql = require("mssql");
const multer = require("multer");
const upload = multer({
    dest: "uploads/",
    fileFilter: (req, file, cb) => {
        // 파일 사이즈 제한 (20MB 이하)
        const maxSize = 20 * 1024 * 1024; // 20MB
        if (file.size > maxSize) {
            return cb(new Error("파일 사이즈는 20MB 이하만 허용됩니다."));
        }

        // 파일 유형 제한 (이미지 파일만 허용)
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("이미지 파일만 허용됩니다."));
        }

        // 파일 허용
        cb(null, true);
    },
    filename: (req, file, cb) => {
        // 유저 아이디와 현재 시간으로 파일 이름 생성
        const userId = req.body.username; // 예시: 유저 아이디는 username으로 전달받음
        const currentTime = Date.now();
        const fileExtension = file.originalname.split(".").pop(); // 파일 확장자

        const fileName = `${userId}-${currentTime}.${fileExtension}`;

        cb(null, fileName);
    },
});
// Express.js 애플리케이션 생성
const app = express();

// 세션 암호화를 위한 비밀키
const secretKey = generateRandomString(32);

// 정적 파일 제공 설정
app.use(express.static(__dirname));

// Body-parser 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 세션 설정
app.use(
    session({
        secret: secretKey,
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 10800000, // 세션 유효 기간 (3시간)
        },
    })
);

// DB 연결 정보 파일을 가져옴
const config = require("./config");
/*
const config = {
  user: 'your_id',
  password: 'your_password',
  server: 'your_server',
  database: 'your_database',
  port: 'your_port',
  options: {
    encrypt: true // 암호화 옵션 (SSL 사용 시)
  }
};
*/

// 로그인 페이지 렌더링
app.get("/login", (req, res) => {
    res.sendFile(__dirname + "/login.html");
});

// 회원가입 페이지 렌더링
app.get("/register", (req, res) => {
    res.sendFile(__dirname + "/register.html");
});

app.post("/create-post", async (req, res) => {
    const { content } = req.body;

    try {
        // DB 연결
        await sql.connect(config);

        console.log(req.session.user.user_id)
        console.log(content)

        // 프로시저 호출
        const result = await sql.query(`
        DECLARE @p_message VARCHAR(100);
        EXEC CreatePost @p_user_id = '${req.session.user.user_id}', @p_content = '${content}', @p_message = @p_message OUTPUT;
        SELECT @p_message AS message;
      `);

        // 결과 반환
        const message = result.recordset[0].message;
        res.status(200).json({ message });
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ error: "Failed to create post" });
    } finally {
        // DB 연결 종료
        sql.close();
    }
});

// 로그인 요청 처리
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        // DB 연결
        await sql.connect(config);

        // 로그인 프로시저 호출
        const result = await sql.query(`
      EXEC LoginUser
        @username = '${username}',
        @password = '${password}';
    `);

        const userData = result.recordset[0];

        console.log(userData);

        if (userData) {
            // 로그인 성공 시 세션에 사용자 정보 저장
            req.session.user = {
                user_id: userData.user_id,
                name: userData.user_name,
                bio: userData.bio,
            };
            req.session.isLoggedIn = true;
            res.status(200).send("로그인 성공");
        } else {
            // 로그인 실패
            res.status(401).send("아이디 또는 비밀번호가 잘못되었습니다.");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("서버 오류가 발생했습니다.");
    } finally {
        // DB 연결 종료
        await sql.close();
    }
});

// 로그인 상태 확인 미들웨어
const checkLoginStatus = (req, res, next) => {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect("/login");
    }
};

// 프로필 페이지 요청 처리
app.get("/api/profile", checkLoginStatus, (req, res) => {
    // 세션에서 사용자 정보 확인
    if (req.session.isLoggedIn) {
        // 로그인 상태일 경우 프로필 정보 반환
        const user = req.session.user;
        const profileInfo = {
            user_id: user.user_id,
            name: user.name,
            bio: user.bio,
        };
        res.json(profileInfo);
    } else {
        // 비로그인 상태일 경우 로그인 페이지로 리다이렉트
        res.redirect("/login");
    }
});

// 로그인 확인 API
app.get("/api/check-login", (req, res) => {
    if (req.session.isLoggedIn) {
        res.json({ isLoggedIn: true, username: req.session.user.name });
    } else {
        res.json({ isLoggedIn: false, username: null });
    }
});

// 로그아웃 처리
app.get("/logout", (req, res) => {
    // 세션 제거
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
        }
        res.redirect("/login");
    });
});

// GET 요청을 처리하는 핸들러
app.get('/posts', async (req, res) => {
    // 최근 n개의 게시글을 요청 파라미터에서 가져오기 (기본값은 10)
    const count = (req.query.count || 10)
    

    try {
        // DB 연결
        await sql.connect(config);

        const result = await sql.query(`
        EXEC GetPost
          @p_cnt = ${count}
      `);
        console.log(result.recordset);
        //const { user_name, content, post_time } = result.recordset[0];
        
        res.json(result.recordset);

    } catch (error) {
        console.error(error);
        res.status(500).send("서버 오류가 발생했습니다.");
    } finally {
        // DB 연결 종료
        await sql.close();
    }
  });
  

// 회원가입 요청 처리
app.post("/register", upload.single("profileImage"), async (req, res) => {
    const { userid, password, user_name, bio, student_id } = req.body;

    if (userid.length < 4) {
        res.status(400).send("아이디가 너무 짧습니다 (최소 4자 이상)");
    } else if (!/^[a-zA-Z0-9_]+$/.test(userid)) {
        res.status(400).send("아이디에 알파벳, 숫자, 언더바 이외의 특수문자가 포함되었습니다");
    }

    if (password.length < 6) {
        res.status(400).send("아이디가 너무 짧습니다 (최소 6자 이상)");
    }

    if (userid.length < 4) {
        res.status(400).send("사용자 이름이 너무 짧습니다 (최소 4자 이상)");
    } else if (!/^[\wㄱ-힣]+$/.test(user_name)) {
        res.status(400).send("사용자 이름에 알파벳, 숫자, 언더바, 한글 이외의 문자가 포함되었습니다");
    }
    
    

    let profileImage = null;
    if (req.file) {
        const uploadedFileName = req.file.filename;
        // 업로드된 파일의 이름을 활용한 로직 처리
        // ...
    }

    try {
        // DB 연결
        await sql.connect(config);

        // 회원가입 프로시저 호출
        const result = await sql.query(`
        DECLARE @registerSuccess BIT;
        DECLARE @errorMessage NVARCHAR(200);
  
        EXEC RegisterUser
          @userid = '${userid}',
          @password = '${password}',
          @user_name = '${user_name}',
          @bio = '${bio}',
          @profile_img = ${
              profileImage ? `0x${profileImage.toString("hex")}` : "NULL"
          }, -- 프로필 이미지 처리
          @student_id = '${student_id}',
          @registerSuccess = @registerSuccess OUTPUT,
          @errorMessage = @errorMessage OUTPUT;
  
        SELECT @registerSuccess AS registerSuccess, @errorMessage AS errorMessage;
      `);

        // 회원가입 결과 처리
        const { registerSuccess, errorMessage } = result.recordset[0];
        if (registerSuccess) {
            // 회원가입 성공
            res.status(200).send("회원가입이 성공적으로 완료되었습니다.");
        } else {
            // 회원가입 실패
            res.status(400).send(errorMessage);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("서버 오류가 발생했습니다.");
    } finally {
        // DB 연결 종료
        await sql.close();
    }
});

// 대시보드 페이지 렌더링
app.get("/dashboard", (req, res) => {
    if (req.session.isLoggedIn) {
        res.send(`Welcome, ${req.session.username}! This is your dashboard.`);
    } else {
        res.redirect("/login");
    }
});

// 서버 실행
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});

function generateRandomString(length) {
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let randomString = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters.charAt(randomIndex);
    }
    return randomString;
}
