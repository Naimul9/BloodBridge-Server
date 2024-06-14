const express = require('express');
const app =express()
const jwt = require('jsonwebtoken')
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
 const donationCollection = client.db('BloodBridge').collection('donation')

//  jwt
app.post('/jwt', async(req,res)=>{
  const user =req.body
  const token =jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{
    expiresIn: '365d'
  })
  res.send({token})
})
// middlewares
const verifyToken = (req,res,next )=>{
  console.log('inside verify token', req.headers);
  if(!req.headers.authorization){
    return res.status(401).send({message: 'forbidden access'})
  }
  const token =req.headers.authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
    if(err){
      return res.status(401).send({message: 'forbidden access'})
    }
    req.decoded = decoded
    next()
  })

}


// get all users 

app.get('/users',verifyToken,async(req,res)=>{
 const result = await usersCollection.find().toArray()
  res.send(result)
})

// get a user data by email
app.get('/user/:email', async(req,res)=>{
  const email =req.params.email
  const result = await usersCollection.findOne({email})
  res.send(result)
})





// save a user data in 
app.put('/user', async(req, res) =>{
const user =req.body
const query ={ email: user?.email}

const isExist = await usersCollection.findOne(query)
if(isExist) return res.send(isExist)


const options ={upsert:true}

const updateDoc ={
    $set:{
        ...user,
        timestamp: Date.now(),
    },
}
const result =await usersCollection.updateOne(query, updateDoc, options)
res.send(result)
})



// save a donation request
app.post ('/add-donation',async(req,res )=>{
    const donationData =req.body
    const result =await donationCollection.insertOne(donationData)
    res.send(result)
})

// get donation data
app.get('/donation', async(req,res)=>{
    const result = await donationCollection.find().toArray()
    res.send(result)
})
// get all donation for donor
app.get('/donation/:email', async (req, res) => {
  const email = req.params.email;
  const status = req.query.status;
  const query = { email: email };

  if (status) {
      query.donationStatus = status;
  }

  const donations = await donationCollection.find(query).toArray();
  res.send(donations);
});

// logout
// clear token
app.get('/logout', (req,res)=>{
    res.clearCookie('token',{
        httpOnly:true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', maxAge:0
    })
    .send({success: true})
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

