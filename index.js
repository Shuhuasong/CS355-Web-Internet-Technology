const fs = require("fs");
const url = require("url");
const http = require("http");

const Jimp = require("jimp");

const port = 3000;
const host = "localhost";

let server = http.createServer(function (req, res) {
    console.log(`Request was made: ${req.method} ${req.url}`);
    if (req.url === "/") {
        let home = fs.createReadStream("./html/index.html");
        home.on("error", function (err) {
            console.log(err);
			res.writeHead(404)
			res.end();
        });
        res.writeHead(200, {"Content-Type": "text/html"});
        home.pipe(res);
    }
    else if (req.url.startsWith("/build")) {
        let order = url.parse(req.url, true).query.q;
        parse_order(order, res);
    }
	else {
		res.writeHead(404)
		res.end();
	}
});

const open_assets = function () {
    const assets = [{id: "b", path: "assets/bun.png"},
                    {id: "p", path: "assets/patty.png"},
                    {id: "c", path: "assets/cheese.png"},
                    {id: "l", path: "assets/lettuce.png"},
                    {id: "t", path: "assets/tomato.png"},
                    {id: "e", path: "assets/egg.png"}];
    let assets_read = 0;
    assets.forEach(function (asset) {
        Jimp.read(asset.path, function (err, resource) {
            if (err) {
                throw err;
            }
            asset.resource = resource;
            assets_read += 1;
            if (assets_read === assets.length) {
                console.log("All images loaded into memory");
            }
        });
    });
    return assets;
};

const parse_order = function (order, res) {
    let burger = [];
    let ids = assets.map((x) => x.id);
    let validated_order = "";
    [...order].forEach(function (letter) {
        let i = ids.indexOf(letter);
        if (i !== -1) {
            burger.push(assets[i]);
            validated_order += letter;
        }
    });
    fs.access(`cache/${validated_order}.png`, function (does_not_exist) {
        if (does_not_exist) {
            console.log("Order Not In Cache");
            create_burger(burger, validated_order, res);
        }
        else {
            console.log("Order In Cache");
            let burger_stream = fs.createReadStream(`cache/${validated_order}.png`);
            res.writeHead(200, {"Content-Type": "image/jpeg"});
            burger_stream.pipe(res);
        }
    });
};

const create_burger = function (burger, order, res) {
    let height = 130 + (25 * burger.length - 1);
    new Jimp(326, height, function (err, canvas) {
        if (err) {
            throw err;
        }
        let yaxis = 0;
        burger.forEach(function (component) {
            canvas.blit(component.resource, 0, yaxis);
            yaxis += 25;
        });
        canvas
            .flip(false, true)
            .write(`cache/${order}.png`, function () {
                let burger_stream = fs.createReadStream(`cache/${order}.png`);
                res.writeHead(200, {"Content-Type": "image/jpeg"});
                burger_stream.pipe(res);
            });
    });
};

server.listen(port, host);
console.log(`Now Listening On Port ${port}`);
let assets = open_assets();