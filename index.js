const express = require('express');
const app =express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, Timestamp } = require('mongodb');

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
  }
  app.use(cors(corsOptions))
  
  app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ahphq0t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
 const usersCollection = client.db('BloodBridge').collection('users')

// save a user data in 
app.put('/user', async(req, res) =>{
const user =req.body


const isExist = await usersCollection.findOne({email: email?.user})
if(isExist) return res.send(isExist)


const options ={upsert:true}
const query ={ email: user?.email}
const updateDoc ={
    $set:{
        ...user,
        timestamp: Date.now(),
    },
}
const result =await usersCollection.updateOne(query, updateDoc, options)
res.send(result)
})

// get all users dat
app.get('/users', async(req,res)=>{
    const result = await usersCollection.find().toArray()
    res.send(result)
})




    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






  app.get('/',(req,res)=>{
    res.send('BloodBridge is running')
  })

  app.listen(port, ()=>{
    console.log(`BloodBridge is running on Port ${port}`);
  })

