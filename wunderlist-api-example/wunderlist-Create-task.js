const fs = require("fs");
const url = require("url");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const querystring = require("querystring");

const credentials = require("./api/credentials.json");

const host = "localhost";
const port = 3000;

let state_tasks = [];

if (Object.values(credentials).includes("")){
    console.log("Credentials Incomplete: Check /api/credentials.json");
    process.exit(-1);
}

const new_connection = function (req, res) {
    if (req.url === "/") {
        res.writeHead(200, {"Content-Type": "text/html"})
        fs
          .createReadStream("./html/index.html")
          .pipe(res);
    }
    else if (req.url.startsWith("/create_task")) {
        let request_data = "";
        req.on("data", function (chunk) {
            request_data += chunk;
            if (request_data.length > 1e6) {
                res.writeHead(413, {'Content-Type':'text/plain'})
                   .end();
                res.connection.destroy();
            }
        });
        req.on("end", function () {
            let user_input = querystring.parse(request_data);
            redirect_to_wunderlist_authorization(user_input, res);
        });
    }
    else if (req.url.startsWith("/receive_code")) {
        let auth_response = url.parse(req.url, true).query;
        if(auth_response.code === undefined || auth_response.state === undefined ){
            res.writeHead(302, {Location:`${host}:${port}`})
               .end();
        }
        let index = state_tasks.findIndex((state_task) => state_task.state === auth_response.state);
        if (index === -1) {
            res.writeHead(302, {Location:`${host}:${port}`})
               .end();
        }
        else if (auth_response.error) {
            res.writeHead(403)
               .end("Wunderlist API Access Denied");
        }
        else {
            let prior = state_tasks.splice(index, 1);
            get_access_token(auth_response.code, prior[0].task, res);
        }
    }
    else {
        res.writeHead(404)
           .end();
    }
};

const redirect_to_wunderlist_authorization = function(user_input, res){
    let state = crypto.randomBytes(20).toString("hex");
    const authorization_endpoint = "https://www.wunderlist.com/oauth/authorize";
    let uri = querystring.stringify({
        client_id: credentials.client_id,
        redirect_uri: credentials.redirect_uri,
        state
    });
    state_tasks.push({state, task: user_input.task});
    res.writeHead(302, {Location: `${authorization_endpoint}?${uri}`})
       .end();
};

const get_access_token = function(code, task, res){
    const access_token_endpoint = "https://www.wunderlist.com/oauth/access_token";
    let post_data = querystring.stringify({
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        code
    });
    let options = {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": post_data.length
        }
    };
    let access_token_request = https.request(access_token_endpoint, options, function (access_token_stream) {
        let access_token_data = "";
        access_token_stream.on("data", (chunk) => access_token_data += chunk);
        access_token_stream.on("end", function () {
            let access_token_wrapper = JSON.parse(access_token_data);
            get_all_lists(access_token_wrapper.access_token, task, res);
        });
    });
    access_token_request.end(post_data);
};

const get_all_lists = function (access_token, task, res) {
    const get_list_endpoint = "https://a.wunderlist.com/api/v1/lists";
    let options = {
        headers: {
            "X-Client-ID": credentials.client_id,
            "X-Access-Token": access_token
        }
    };
    https.get(get_list_endpoint, options, function (list_stream) {
        let list_data = "";
        list_stream.on("data", (chunk) => list_data += chunk);
        list_stream.on("end", function () {
            let lists = JSON.parse(list_data);
            let list_id = lists[0].id;
            create_task(list_id, access_token, task, res);
        });
    });
};

const create_task = function (list_id, access_token, task, res) {
    const task_endpoint = "https://a.wunderlist.com/api/v1/tasks";
    let post_data = JSON.stringify({
        list_id,
        title: task
    });
    let options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": post_data.length,
            "X-Client-ID": credentials.client_id,
            "X-Access-Token": access_token
        }
    };
    let task_request = https.request(task_endpoint, options, function (task_stream) {
        let task_result_data = "";
        task_stream.on("data", function (chunk) {task_result_data += chunk;});
        task_stream.on("end", function () {
            res.writeHead(200, {"Content-Type":"text/html"})
               .end(`<body style="zoom:250%"><p>Task created on <a href="https://www.wunderlist.com/" target="_blank">Wunderlist</a></p><p><a target="_blank" href="https://www.wunderlist.com/account/applications">Revoke Permissions</a></p></body>`);
        });
    });
    task_request.end(post_data);
};

const server = http.createServer(new_connection);
server.listen(port, host);
console.log(`Server now listening on ${host}:${port}`);
