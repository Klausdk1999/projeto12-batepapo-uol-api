import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import chalk from "chalk";
import joi from "joi";

const nameSchema = joi.object({
    name: joi.string().required()
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().valid(...['message','private_message'])
});

dotenv.config();

const app = express();

app.use(cors());

app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URL);//uri
let db;

setInterval(isOnline, 15000);

async function isOnline(){
    
    try {
	    const participants = await db.collection('participants').find().toArray();
		for(let i=0;i<participants.length;i++){
            if((Date.now()-participants[i].lastStatus)>=10000){
                const message= {from: participants[i].name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs().format("HH:mm:ss")};
                db.collection('messages').insertOne(message);
                db.collection('participants').deleteOne(participants[i]);
            }
        }	

	} catch (error) {
	  res.status(500).send('A culpa foi do estagiário')
	}  
}

mongoClient.connect().then(()=> {
    db = mongoClient.db("batepapouol");
});

app.post("/participants", async (req, res) => {

    const validation = nameSchema.validate(req.body, { abortEarly: true });

    if (validation.error) {
        res.sendStatus(422);
        return;
    }
  
    const { name } = req.body;
   
    const usuarioIsTaken = await db.collection('participants').find({ name }).toArray();
    
    if(usuarioIsTaken.length>0){
        res.sendStatus(409);
        return;
    }

    const participant = { name, lastStatus: Date.now()};

    const message = {
        from: name, 
        to: 'Todos', 
        text: 'entra na sala...', 
        type: 'status', 
        time: dayjs().format("HH:mm:ss")
    };

    db.collection('participants').insertOne(participant);
    db.collection('messages').insertOne(message);

    res.sendStatus(201);
});

app.get("/participants", (req, res) => {
    const promise = db.collection('participants').find().toArray();
    promise.then(participants => res.send(participants));
});

app.post("/messages", async (req, res) => {

    const validation = messageSchema.validate(req.body, { abortEarly: true });

    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    const { to, text, type } = req.body;
    
    const from = req.headers.user;
    
    const isValidUser = await db.collection('messages').find({ from:from }).toArray();
    
    if(!(isValidUser.length>0)){
        res.sendStatus(409);
        return;
    }

    const message = {
        from, 
        to, 
        text, 
        type, 
        time: dayjs().format("HH:mm:ss")
    };

    db.collection('messages').insertOne(message);

    res.sendStatus(201);
});

app.get("/messages", (req, res) => {
    const { limit } = req.query;
    const { user } = req.headers;
    const promise = db.collection('messages').find().toArray();

    promise.then(messages => {

        const userMessages = messages.filter(message=> {
            if (message.from === user || message.to === "Todos" || message.type === 'status'||(message.type === 'private_message' && message.to === user )) {
                return true;
            } else {
                return false;
            }
        });

        if (userMessages.length < limit) {
            res.send(userMessages);
        } else {
            res.send(userMessages.slice(userMessages.length-limit-1, userMessages.length));
        }
    });
});

app.post("/status", (req, res) => {
    const { user } = req.headers;
    const promise = db.collection('participants').find({name:user}).toArray();
    promise.then(userdata => {
       if(userdata){
        //const participant = { $set:{ lastStatus: Date.now()}};
        db.collection('participants').updateOne({name:user},{ $set:{ lastStatus: Date.now()}});
        res.sendStatus(200);
       }else{
        res.sendStatus(404);
       }
    });
});

// app.delete("/messages/:ID_DA_MENSAGEM", (req, res) => {
//     const { user } = req.headers;
//     const promise = db.collection('participants').find({name:user}).toArray();
//     promise.then(userdata => {
//        if(userdata){
//         //const participant = { $set:{ lastStatus: Date.now()}};
//         db.collection('participants').updateOne({name:user},{ $set:{ lastStatus: Date.now()}});
//         res.sendStatus(200);
//        }else{
//         res.sendStatus(404);
//        }
//     });
// });

// app.put("/messages/:ID_DA_MENSAGEM", (req, res) => {
//     const { user } = req.headers;
//     const promise = db.collection('participants').find({name:user}).toArray();
//     promise.then(userdata => {
//        if(userdata){
//         //const participant = { $set:{ lastStatus: Date.now()}};
//         db.collection('participants').updateOne({name:user},{ $set:{ lastStatus: Date.now()}});
//         res.sendStatus(200);
//        }else{
//         res.sendStatus(404);
//        }
//     });
// });

app.listen(5000);