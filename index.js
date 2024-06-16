const express = require('express');
const app =express()
const jwt = require('jsonwebtoken')
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, Timestamp, ObjectId } = require('mongodb');

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
  }
app.use(cors(corsOptions))
app.use(express.json())

// verify token
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
  })}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ahphq0t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


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
const blogsCollection = client.db('BloodBridge').collection('blogs');
//  jwt
app.post('/jwt', async(req,res)=>{
  const user =req.body
  const token =jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{
    expiresIn: '365d'
  })
  res.send({token})
})
// middlewares

  // verify admin
  const verifyAdmin =async(req,res, next)=>{
    const email =req.decoded.email
    const query = {email: email}
    const user =await usersCollection.findOne(query)
    const isAdmin = user?.role==='admin'
    if(!isAdmin){
      return res.status(403).send({message: 'forbidden access'})
    }
    next()
  }


// get all users 

app.get('/users',verifyToken, verifyAdmin,  async(req,res)=>{
 const result = await usersCollection.find().toArray()
  res.send(result)
})

// get all donor
app.get('/users/donor', verifyToken, async (req, res) => {
  try {
    const result = await usersCollection.find({ role: 'donor' }).toArray();
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// get a user data by email
app.get('/user/:email', async(req,res)=>{
  const email =req.params.email
  const result = await usersCollection.findOne({email})
  res.send(result)
})

  // block or unblock user
  app.put('/user/status', verifyToken, verifyAdmin, async (req, res) => {
    const { email, status } = req.body;
    const query = { email };
    const updateDoc = {
      $set: { status },
    };
    const result = await usersCollection.updateOne(query, updateDoc);
    res.send(result);
  });

  // update user role
  app.put('/user/role', verifyToken, verifyAdmin, async (req, res) => {
    const { email, role } = req.body;
    const query = { email };
    const updateDoc = {
      $set: { role },
    };
    const result = await usersCollection.updateOne(query, updateDoc);
    res.send(result);
  });



// save a user data in 
app.put('/user', async(req, res) =>{
const user =req.body
const query ={ email: user?.email , status:user?.status}

const isExist = await usersCollection.findOne(query)
if(isExist){
  if(user.status ==='blocked'){
    const result = await usersCollection.updateMany(query, {$set:{status: user?.status},})
    return res.send(result)
  }else{
    return res.send(isExist)
  }
}
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
// Change from POST to PUT for updating or inserting a donation
// save a donation request (insert or update)
app.put('/add-donation', async (req, res) => {
  const donationData = req.body;

  try {
    if (donationData._id) {
      // Update existing donation
      const query = { _id: new ObjectId(donationData._id) };
      const updateDoc = {
        $set: {
          donationStatus: donationData.donationStatus,
          donorName: donationData.donorName,
          donorEmail: donationData.donorEmail,
          // Add other fields as needed
        },
      };
      const result = await donationCollection.updateOne(query, updateDoc);
      res.send(result);
    } else {
      // Insert new donation (if _id is not provided, insert will be executed)
      const result = await donationCollection.insertOne(donationData);
      res.send(result);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});




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


// get donation info by id 
app.get('/donations/:id', async (req, res) => {
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await donationCollection.findOne(query)
  res.send(result)
});


// Update donation status by ID
app.put('/donations/:id/status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const query = { _id: new ObjectId(id) };
    const updateDoc = { $set: { donationStatus: status } };
    const result = await donationCollection.updateOne(query, updateDoc);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Delete donation by ID
app.delete('/donations/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = { _id: new ObjectId(id) };
    const result = await donationCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

 // Blog management

        // add a blog
        app.post('/blogs', verifyToken, verifyAdmin, async (req, res) => {
          const blog = req.body;
          blog.status = 'draft';
          const result = await blogsCollection.insertOne(blog);
          res.send(result);
      });

      // get all blogs
      app.get('/blogs', verifyToken, async (req, res) => {
          const status = req.query.status;
          let query = {};
          if (status) {
              query.status = status;
          }
          const result = await blogsCollection.find(query).toArray();
          res.send(result);
      });

      // update a blog
      app.put('/blogs/:id', verifyToken, verifyAdmin, async (req, res) => {
          const id = req.params.id;
          const blog = req.body;
          const query = { _id: new MongoClient.ObjectId(id) };
          const updateDoc = {
              $set: blog,
          };
          const result = await blogsCollection.updateOne(query, updateDoc);
          res.send(result);
      });

      // publish a blog
      app.put('/blogs/:id/publish', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        try {
            const query = { _id: new ObjectId(id) };
            const update = { $set: { status: 'published' } };
            const result = await blogsCollection.updateOne(query, update);
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: 'Failed to publish blog', error });
        }
    });

      // unpublish a blog
      app.put('/blogs/:id/unpublish', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        try {
            const query = { _id: new ObjectId(id) };
            const update = { $set: { status: 'draft' } };
            const result = await blogsCollection.updateOne(query, update);
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: 'Failed to unpublish blog', error });
        }
    });
    
      // delete a blog
      app.delete('/blogs/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        try {
            const query = { _id: new ObjectId(id) };
            const result = await blogsCollection.deleteOne(query);
            res.send(result);
        } catch (error) {
            res.status(500).send({ message: 'Failed to delete blog', error });
        }
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

