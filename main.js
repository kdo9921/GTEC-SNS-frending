var postCount = 10;
let isLoggedIn = false; // 로그인 상태에 따라 true 또는 false로 설정
var userdata;
const Editor = toastui.Editor;
var editor;

function SetEditor() {
    const Editor = toastui.Editor;
    
    var theme = 'default'
    
    try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            theme = 'dark'
        }
    } catch {
        theme = 'default'
    }

    console.log(theme)

    editor = new Editor({
        el: document.querySelector("#editor"),
        height: "300px",
        initialEditType: "markdown",
        previewStyle: "vertical",
        toolbarItems: [
            ['heading', 'bold', 'italic', 'strike'],
            ['hr', 'quote'],
            ['ul', 'ol'],
            ['code', 'codeblock'],
            ['link', 'image']
        ],
        theme : theme,
        hooks: {
            addImageBlobHook: (blob, callback) => {
                const formData = new FormData();
                formData.append("image", blob);

                const xhr = new XMLHttpRequest();
                xhr.open("POST", "/upload");
                xhr.onload = function () {
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);
                        const imageName = response.imageName;
                        callback(`/uploads/${imageName}`, imageName);
                    } else {
                        callback("image_load_fail", "이미지 로드 실패");
                    }
                };
                xhr.send(formData);
            },
        },
    });
}

function showPage(isLoggedIn) {
    const profilePage = document.querySelector("#profilePage");
    const loginSignupCard = document.querySelector("#loginSignupCard");
    const logoutButton = document.querySelector("#logoutButton");
    const newPost = document.querySelector("#newPost");

    if (isLoggedIn) {
        // 로그인 상태인 경우
        profilePage.classList.remove("hidden");
        loginSignupCard.classList.add("hidden");
        logoutButton.classList.remove("hidden");
        newPost.classList.remove("hidden");
    } else {
        // 로그인 상태가 아닌 경우
        profilePage.classList.add("hidden");
        loginSignupCard.classList.remove("hidden");
        logoutButton.classList.add("hidden");
        newPost.classList.add("hidden");
    }
}

// 로그인 상태 확인 API 호출
async function checkLoginStatus() {
    try {
        const response = await fetch("/api/check-login");
        if (!response.ok) {
            throw new Error("로그인 상태 확인에 실패했습니다.");
        }
        const data = await response.json();

        if (data.isLoggedIn) {
            isLoggedIn = true;
            fetchProfileInfo();
        } else {
            isLoggedIn = false;
        }

        showPage(isLoggedIn);
    } catch (error) {
        console.error(error);
        isLoggedIn = false;
        showPage(isLoggedIn);
    }
}

// 프로필 정보 요청 처리
async function fetchProfileInfo() {
    try {
        const response = await fetch("/api/profile");
        const data = await response.json();

        if (response.ok) {
            // 프로필 정보 업데이트
            const profileName = document.querySelector("#profileName");
            const profileBio = document.querySelector("#profileBio");
            const profileUserId = document.querySelector("#profileUserId");

            profileName.textContent = data.name;
            profileBio.textContent = data.bio;
            profileUserId.textContent = data.user_id;
            userdata = data;
        } else {
            console.error(data.message);
        }
    } catch (error) {
        console.log("error");
    }
}

function btn_PostClick() {
    // 입력값 가져오기
    const content = editor.getHTML();

    if (editor.getMarkdown().length == 0) {
        alert("내용을 입력해주세요");
        return;
    }

    // 요청 데이터 생성
    const requestData = {
        content: content,
    };

    // POST 요청 보내기
    fetch("/create-post", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("Post creation result:", data.message);
            // 원하는 동작 수행 (예: 메시지 출력, 페이지 리로드 등)
        })
        .catch((error) => {
            console.error("Error creating post:", error);
            // 에러 처리
        });

    editor.setMarkdown("");
    getPosts(postCount);
}

// 포스트 리스트를 채우는 함수
function fillPostList(posts) {
    const postList = document.querySelector("#postList");

    var postHTML = ''

    // 새로운 포스트 리스트 채우기
    posts.forEach((post) => {
        postHTML += `
            <div class="card mb-3">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${post.user_name}</h5>
                    <div class="card-text flex-grow-1">${post.content}</div>
                    <div class="d-flex justify-content-between">
                        <div class="card-text">${post.created_at}</div>
                        <div>
                            <button class="btn btn-danger btn-report" onclick="reportPost(${post.post_id})">신고</button>
                        </div>
                    </div>
                    <span class="hidden">${post.post_id}</span>
                </div>
            </div>
            `;
    });

    postList.innerHTML = postHTML;

    

}

let canLoadPosts = true;

// 포스트 리스트를 가져오는 함수
async function getPosts(count) {
    if (!canLoadPosts) {
        return;
    }

    try {
        const response = await fetch(`/posts?count=${count}`);

        if (!response.ok) {
            throw new Error("포스트 리스트를 가져오는데 실패했습니다.");
        }
        const posts = await response.json();

        if (posts.length == count);
        {
            postCount += 5;
        }

        var scrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;

        fillPostList(posts);

        window.scrollTo(0, scrollPosition);

    } catch (error) {
        console.log(error);
    }

    canLoadPosts = false;

    setTimeout(() => {
        canLoadPosts = true;
    }, 2500);
}

// 초기 포스트 리스트 가져오기
getPosts(postCount);

window.onscroll = function () {
    // 스크롤이 페이지의 아래쪽에 도달하면 getPosts() 함수를 호출합니다.
    if (
        window.innerHeight + window.pageYOffset >=
        document.documentElement.scrollHeight
    ) {
        getPosts(postCount);
    }
};

window.onload = function () {
    SetEditor();

    checkLoginStatus();

    document
        .getElementById("postButton")
        .addEventListener("click", btn_PostClick);
};

console.log(`이 메시지를 보고계실 누군가에게. 
안녕하세요. 우선 저희의 작품에 관심을 주셔서 감사하다는 말씀을 드리고 싶습니다.
            
안타깝게도, "학교 축제떄 전시할 작품이 필요하니 너희가 만들어봐라" 라는 말을 축제 10일 전에 들어서 저희도 준비할 시간이 많이 부족했습니다. 

이 메시지를 보고 계시다는건 저희의 작품을 분석하거나 보안 허점이 있는지 확인을 해보려는 것이겠죠?^^
안타깝게도 익숙하지 않은 분야를 급하게 하느라 XSS, SQL 인젝션 등에 대한 대처는 간소하게 되어있습니다.
아마 개발자 메뉴 열어서 이 메시지를 보고계실분이 마음먹고 뚫으려 한다면 금방 뚫리겠지요...

보안 허점을 발견하더라도 작품이 전시되는 축제 기간동안 너그럽게 봐주시고 모른척 해주시면 감사하겠습니다ㅠㅠ
혹시 서버 코드, DB 설계를 보고 싶으시면 me@darae.dev로 메일 주시기 바랍니다.
`);

function reportPost(postId) {
    // 로그인 확인
    if (!isLoggedIn) {
        alert("로그인 후 이용해주세요.");
        return;
    }
    // 쿠키 확인
    const lastReportTime = getCookie("lastReportTime");
    const currentTime = new Date().getTime();
    const elapsed = currentTime - lastReportTime;

    // 1분 이내에 신고한 경우
    if (lastReportTime && elapsed < 60000) {
        alert("1분에 한 번만 신고할 수 있습니다.");
        return;
    }

    // 1분 이상 경과한 경우, 서버에 신고 요청 전송
    fetch("/report", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ postId }),
    })
        .then((data) => {
            console.log(data);
            // 신고 요청 결과 처리
            if (data.status == 200) {
                // 신고 성공
                // 신고 성공 시 쿠키 설정
                setCookie("lastReportTime", currentTime, 1); // 쿠키 유효 기간: 1분
                alert("신고가 접수되었습니다.");
            } else {
                // 신고 실패
            }
        })
        .catch((error) => {
            console.log("Error reporting post:", error);
            // 에러 처리
        });
}

// 쿠키 설정
function setCookie(name, value, minutes) {
    const date = new Date();
    date.setTime(date.getTime() + minutes * 60 * 1000);
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
}

// 쿠키 가져오기
function getCookie(name) {
    const cookieName = `${name}=`;
    const cookieArray = document.cookie.split(";");
    for (let i = 0; i < cookieArray.length; i++) {
        let cookie = cookieArray[i];
        while (cookie.charAt(0) === " ") {
            cookie = cookie.substring(1);
        }
        if (cookie.indexOf(cookieName) === 0) {
            return cookie.substring(cookieName.length, cookie.length);
        }
    }
    return null;
}
