const express = require('express')
const http = require('http')
var cors = require('cors')
const app = express()
const bodyParser = require('body-parser')
const path = require("path")
var xss = require("xss")

var server = http.createServer(app)
var io = require('socket.io')(server,
	{
		allowEIO3: true, // false by default
	
	  }
	).listen(443);

app.use(cors())
app.use(bodyParser.json())

// if(process.env.NODE_ENV==='production'){
// 	app.use(express.static(__dirname+"/build"))
// 	app.get("*", (req, res) => {
// 		res.sendFile(path.join(__dirname+"/build/index.html"))
// 	})
// }
app.set('port', (process.env.PORT || 443))

const sanitizeString = (str) => {
	return xss(str)
}

let connections = {}
let messages = {}
let timeOnline = {}
let users = {}

io.on('connection', (socket) => {

	socket.on('join-call', (path, username) => {
		if(connections[path] === undefined){
			connections[path] = []
		}
		connections[path].push(socket.id)
		users[socket.id]=username;
		timeOnline[socket.id] = new Date()

		for(let a = 0; a < connections[path].length; ++a){
			io.to(connections[path][a]).emit("user-joined", socket.id, connections[path], users)
		}

		if(messages[path] !== undefined){
			for(let a = 0; a < messages[path].length; ++a){
				io.to(socket.id).emit("chat-message", messages[path][a]['data'], 
					messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
			}
		}

		// console.log(path, connections[path])
		
	})

	socket.on('signal', (toId, message) => {
		io.to(toId).emit('signal', socket.id, message)
	})

	socket.on('chat-message', (data, sender) => {
		data = sanitizeString(data)
		sender = sanitizeString(sender)

		var key
		var ok = false
		for (const [k, v] of Object.entries(connections)) {
			for(let a = 0; a < v.length; ++a){
				if(v[a] === socket.id){
					key = k
					ok = true
				}
			}
		}

		if(ok === true){
			if(messages[key] === undefined){
				messages[key] = []
			}
			messages[key].push({"sender": sender, "data": data, "socket-id-sender": socket.id})
			// console.log("message", key, ":", sender, data)

			for(let a = 0; a < connections[key].length; ++a){
				io.to(connections[key][a]).emit("chat-message", data, sender, socket.id)
			}
		}
	})

	socket.on('disconnect', () => {
		// var diffTime = Math.abs(timeOnline[socket.id] - new Date())
		var key
		for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {
			for(let a = 0; a < v.length; ++a){
				if(v[a] === socket.id){
					key = k

					for(let a = 0; a < connections[key].length; ++a){
						io.to(connections[key][a]).emit("user-left", socket.id)
					}
			
					var index = connections[key].indexOf(socket.id)
					connections[key].splice(index, 1)

					// console.log(key, socket.id, Math.ceil(diffTime / 1000))

					if(connections[key].length === 0){
						delete connections[key]
					}
				}
			}
		}
		if(connections.length===0)users={};
	})
})

server.listen(app.get('port'), () => {
	console.log("listening on", app.get('port'))
})