const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');

const credentials = require('./credentials.json');

const authorization_endpoint = "https://www.wunderlist.com/oauth/authorize?";
const access_token_endpoint = 'https://www.wunderlist.com/oauth/access_token';

const connection_established = function(request,response){
	console.log(request.url);
	if(request.url === "/"){
		const client_id = `client_id=${encodeURIComponent(credentials.client_id)}`;
		const redirect_uri = `redirect_uri=${encodeURIComponent(credentials.redirect_uri)}`;
		const state = `state=${encodeURIComponent(credentials.state)}`;
		const uri = `${client_id}&${redirect_uri}&${state}`;
		console.log(`${authorization_endpoint}${uri}`);
		response.writeHead(302,  {Location: `${authorization_endpoint}${uri}`});
		response.end();
	}
	else if(request.url.startsWith("/return")){
		auth_response = url.parse(request.url,true).query;
		const post_data = querystring.stringify({
			'client_id': credentials.client_id,
			'client_secret': credentials.client_secret,
			'code': auth_response.code
		});
		const options = {
			'method':'POST',
			'headers':{
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': post_data.length
			}
		};
		let access_token_request = https.request(access_token_endpoint, options, function(access_token_response_buffer){
			access_token_received(access_token_response_buffer,response);
		});
		access_token_request.on('error', function(e){ console.error(e); });
		access_token_request.write(post_data);
		console.log("Requesting Access Token");
		access_token_request.end();
	}
}

const access_token_received = function(access_token_response_buffer,response){
	access_token_response_buffer.setEncoding("utf8");
	let access_token_response = "";
	access_token_response_buffer.on("data", data => {access_token_response += data;});
	access_token_response_buffer.on("end", () => {
		const access_token = JSON.parse(access_token_response).access_token;
		get_lists(access_token,response);
	});
};

const get_lists = function(access_token,response){
	const get_list_endpoint = "https://a.wunderlist.com/api/v1/lists";
	const options = {
		'headers':{
			'X-Client-ID': credentials.client_id,
			'X-Access-Token': access_token
		}
	}
	get_list_request = https.get(get_list_endpoint, options, function(list_buffer){
		let list_response = "";
		list_buffer.on("data", data => {list_response += data;});
		list_buffer.on("end", () => {
			const all_lists = JSON.parse(list_response);
			const list_id = all_lists[0].id;
			create_task(list_id, access_token, response);
		});
	});
	get_list_request.on('error', function(e){ console.error(e); });
	console.log("Requesting List");
	get_list_request.end();
}

const create_task = function (list_id, access_token, response){
	const post_data = JSON.stringify({
		'list_id': list_id,
		'title': "Do CS355 Homework"
	});
	console.log(post_data);
	const options = {
		'method':'POST',
		'headers':{
			'X-Client-ID': credentials.client_id,
			'X-Access-Token': access_token,
			'Content-Type': 'application/json',
			'Content-Length': post_data.length
		}
	}
	const task_endpoint = "https://a.wunderlist.com/api/v1/tasks"
	
	let access_token_request = https.request(task_endpoint, options, function(create_task_response_buffer){
		if(create_task_response_buffer.statusCode === 201){
			response.end("Task Created");
		}
		else{
			response.end(create_task_response_buffer.statusCode);
		}
	});
	access_token_request.on('error', function(e){ console.error(e); });
	access_token_request.write(post_data);
	console.log("Creating New Task");
}


const server = http.createServer(connection_established);
server.listen(3000);


