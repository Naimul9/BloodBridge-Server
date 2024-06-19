const express = require('express');
const Stripe = require('stripe');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

// Verify token
const verifyToken = (req, res, next) => {
  console.log('inside verify token', req.headers);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'forbidden access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'forbidden access' });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ahphq0t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const usersCollection = client.db('BloodBridge').collection('users');
    const donationCollection = client.db('BloodBridge').collection('donation');
    const blogsCollection = client.db('BloodBridge').collection('blogs');
    const fundingCollection = client.db('BloodBridge').collection('funding');

    // JWT generation
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      });
      res.send({ token });
    });

    // Verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    };
    // Verify donor middleware
    const verifyDonor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isDonor = user?.role === 'donor';
      if (!isDonor) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    };







    // Payment routes
    // Create Payment Intent
    app.post('/create-payment-intent', async (req, res) => {
      try {
        const { price, } = req.body;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: price,
          currency: 'usd',
          payment_method_types: ['card'],

        });

        // Save funding record to MongoDB
        const newFunding = {
          amount: price,
          userName: req.body.userName,
          date: req.body.date,


        };

        await fundingCollection.insertOne(newFunding);


        res.status(200).json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
      }
    });



    // Get funding records
    app.get('/funding', async (req, res) => {
     
      const result = await fundingCollection.aggregate([{
$group:{
  _id: null,
  totalAmount:{
    $sum: '$amount'
  }
}
}]).toArray()

const amount = result.length>0? result[0].totalAmount :0 
res.send({amount})
    });

    // get all funding 
    app.get('/funding/all', async(req,res)=>{
      const result = await fundingCollection.find().toArray()
      res.send(result)
    })




    // User routes
    app.get('/users',  async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    

    app.get('/users/donor', verifyToken, async (req, res) => {
      try {
        const result = await usersCollection.find({ role: 'donor' }).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
       const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    app.put('/user/status', verifyToken, verifyAdmin, async (req, res) => {
      const { email, status } = req.body;
      const query = { email };
      const updateDoc = { $set: { status } };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.put('/user/role', verifyToken, verifyAdmin, async (req, res) => {
      const { email, role } = req.body;
      const query = { email };
      const updateDoc = { $set: { role } };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // save a user data in 
app.put('/user', async(req, res) =>{
  const user =req.body
  const query ={ email: user?.email , status:user?.status}
  
  const isExist = await usersCollection.findOne(query)
  if(isExist)
    
      return res.send(isExist)
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

  // update a user
  app.put('/user/update', async(req, res) =>{
    const userData = req.body;
      
      try {
        if (userData._id) {
          const query = { _id: new ObjectId(userData._id) };
          const options = { upsert: true };
          const updateDoc = {
            $set: {
               
              timestamp: Date.now(),
              name: userData.name,
              email: userData.email,
              district: userData.district,
              upazila: userData.upazila,
              bloodGroup: userData.bloodGroup,
              photo: userData.photo 
            },
          };
          const result = await usersCollection.updateOne(query, updateDoc,options);
          res.send(result);
        } else {
          const result = await donationCollection.insertOne(userData);
          res.send(result)
          res.status(400).send({ message: 'Email is required' });
        }
      } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });


  
  
  
    
    

    // Donation routes
    app.put('/add-donation', async (req, res) => {
    const donationData = req.body;
    try {
      if (donationData._id) {
        const query = { _id: new ObjectId(donationData._id) };
        const updateDoc = {
          $set: {
            donationStatus: donationData.donationStatus,
            donorName: donationData.donorName,
            donorEmail: donationData.donorEmail,
            recipientName: donationData.recipientName,
            hospitalName: donationData.hospitalName,
            recipientDistrict: donationData.recipientDistrict,
            recipientUpazila: donationData.recipientUpazila,
            fullAddress: donationData.fullAddress,
            donationDate: donationData.donationDate,
            donationTime: donationData.donationTime,
            requestMessage: donationData.requestMessage,
          },
        };
        const result = await donationCollection.updateOne(query, updateDoc);
        res.send(result);
      } else {
        const result = await donationCollection.insertOne(donationData);
        res.send(result);
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  app.get('/donation', async (req, res) => {
    const { status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) {
      query.donationStatus = status;
    }

    try {
      const donations = await donationCollection
        .find(query)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .toArray();

      const total = await donationCollection.countDocuments(query);

      res.status(200).json({ donations, total });
    } catch (error) {
      console.error('Failed to fetch donations', error);
      res.status(500).json({ message: 'Failed to fetch donations', error });
    }
  });

  // pending req
  app.get('/donation/pending', async (req, res) => {
    const result = await donationCollection.find().toArray();
    res.send(result);
  });




  app.get('/donation/:email', async (req, res) => {
    const email = req.params.email;
    const { status, page = 1, limit = 10 } = req.query;
    const query = { email: email };
    if (status) {
      query.donationStatus = status;
    }
    try {
      const donations = await donationCollection
        .find(query)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .toArray();
      const total = await donationCollection.countDocuments(query);
      res.status(200).json({ donations, total });
    } catch (error) {
      console.error('Failed to fetch donations', error);
      res.status(500).json({ message: 'Failed to fetch donations', error });
    }
  });

  app.get('/donations/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await donationCollection.findOne(query);
    res.send(result); 
  });

  app.put('/donations/:id/status', verifyToken, async (req, res) => {
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

  app.delete('/donations/:id', verifyToken, async (req, res) => {
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

  // Blog routes
  app.post('/blogs', verifyToken, verifyAdmin, async (req, res) => {
    const blog = req.body;
    blog.status = 'draft';
    const result = await blogsCollection.insertOne(blog);
    res.send(result);
  });

  app.get('/blogs', verifyToken, async (req, res) => {
    const status = req.query.status;
    let query = {};
    if (status) {
      query.status = status;
    }
    const result = await blogsCollection.find(query).toArray();
    res.send(result);
  });

  app.get('/blogs/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await blogsCollection.findOne(query);
    res.send(result);
  });

  app.put('/blogs/:id', verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const blog = req.body;
    const query = { _id: new ObjectId(id) };
    const updateDoc = { $set: blog };
    const result = await blogsCollection.updateOne(query, updateDoc);
    res.send(result);
  });

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

  // Logout
  app.get('/logout', (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 0,
    }).send({ success: true });
  });

  await client.db('admin').command({ ping: 1 });
  console.log('Pinged your deployment. You successfully connected to MongoDB!');
} finally {
  // Ensures that the client will close when you finish/error
  // await client.close();
}
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('BloodBridge is running');
});

app.listen(port, () => {
  console.log(`BloodBridge is running on Port ${port}`);
});
