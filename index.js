
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
// @ terminal node > require('crypto').randomBytes(64).toString('hex')
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 3000; // Use process.env.PORT or default to 3000

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zkhcmhi.mongodb.net/?retryWrites=true&w=majority`;

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
    const userCollection = client.db("surveyDb").collection("users");
    const reviewCollection = client.db("surveyDb").collection("reviews");
    const surveyCollection = client.db("surveyDb").collection("survey");
    const voteCollection = client.db("surveyDb").collection("vote");
    const paymentCollection = client.db("surveyDb").collection("payments");
    const contactUsCollection = client.db("surveyDb").collection("contact");


    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // middleware

    const verifyToken = (req, res, next) => {
      console.log('token middle', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbiden' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'forbiden' })
        }
        req.decoded = decoded;
        next()
      })
      // next()
    }


       // use verify admin after verifyToken
       const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.admin === true;
        if (!isAdmin) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }

       // use verify admin after verifyToken
       const verifySurveyor = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isSurveyor = user?.surveyor === true;
        if (!isSurveyor) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }


    // users related api


    app.get('/users',  async (req, res) => {
      // console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/:id',verifyToken,verifyAdmin ,async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.findOne(query)
      res.send(result)
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.admin === true;
      }
      res.send({ admin });
    })



    app.get('/users/surveyor/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let surveyor = false;
      if (user) {
        surveyor = user?.surveyor === true;
      }
      res.send({ surveyor });
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists: 
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    // app.post('/users',async (req, res)=>{
    //   const user = req.body;
    //   const result = await userCollection.insertOne(user);
    //   res.send(result)
    // })


    //  user = admin


    app.patch('/users/admin/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          admin: true
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    // user =Surveyor


    app.patch('/users/surveyor/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          surveyor: true
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    // user = proUser


    app.patch('/users/prouser/:id',verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          proUser: true
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })


    // survey


    app.get('/surveys', async (req, res) => {
      const result = await surveyCollection.find().toArray();
      res.send(result);
    });

    app.get('/surveys/:id',async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await surveyCollection.findOne(query)
      res.send(result)
    })

    app.patch('/surveys/:id',verifyToken, async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          title: item.title,
          description: item.description,
          question1: item.question1,
          category: item.category,
         
        }
      }
      const result = await surveyCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.patch('/surveys/survey/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "Accept"
        }
      }
      const result = await surveyCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })
    app.patch('/surveys/survey/decline/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "Decline",
          message:"Your Post Hase Been Declined"
        }
      }
      const result = await surveyCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })






    // app.put('/surveys/survey/:id/like', async (req, res) => {
    //   const { id } = req.params;
    //   const { action } = req.body; // 'like' or 'unlike'
    
    //   try {
    //     const post = await client.db("surveyDb").collection('survey').findOne({ _id: new ObjectId(id) });
    
    //     if (!post) {
    //       return res.status(404).json({ message: 'Post not found' });
    //     }
    
    //     if (action === 'like') {
    //       await client.db("surveyDb").collection('survey').updateOne(
    //         { _id: ObjectId(id) },
    //         { $inc: { likes: 1 } }
    //       );
    //     } else if (action === 'unlike') {
    //       await client.db("surveyDb").collection('survey').updateOne(
    //         { _id: ObjectId(id), likes: { $gt: 0 } },
    //         { $inc: { likes: -1 } }
    //       );
    //     } else {
    //       return res.status(400).json({ message: 'Invalid action' });
    //     }
    
    //     const updatedPost = await client.db("surveyDb").collection('survey').findOne({ _id: new ObjectId(id) });
    //     res.status(200).json({ likes: updatedPost.likes });
    //   } catch (error) {
    //     console.error(error);
    //     res.status(500).json({ message: 'Server Error' });
    //   }
    // });
    

    // app.put('/surveys/survey/:id/like', async (req, res) => {
    //   const { id } = req.params;
    //   const { action } = req.body; // action will be 'like' or 'unlike'
    
    //   try {
    //     const post = await client.db("surveyDb").collection('survey').findOne({ _id: new ObjectId(id) });
    
    //     if (!post) {
    //       return res.status(404).json({ message: 'Post not found' });
    //     }
    
    //     if (action === 'like') {
    //       await client.db("surveyDb").collection('survey').updateOne(
    //         { _id: ObjectId(id) },
    //         { $inc: { likes: 1 } }
    //       );
    //     } else if (action === 'unlike') {
    //       await client.db("surveyDb").collection('survey').updateOne(
    //         { _id: ObjectId(id), likes: { $gt: 0 } },
    //         { $inc: { likes: -1 } }
    //       );
    //     } else {
    //       return res.status(400).json({ message: 'Invalid action' });
    //     }
    
    //     const updatedPost = await client.db("surveyDb").collection('survey').findOne({ _id:new ObjectId(id) });
    //     res.status(200).json({ likes: updatedPost.likes });
    //   } catch (error) {
    //     console.error(error);
    //     res.status(500).json({ message: 'Server Error' });
    //   }
    // });
    // app.put('/surveys/survey/:id/like', async (req, res) => {
    //   const postId = req.params.postId;
    //   try {
    //     const updatedPost = await db
    //       .collection('posts')
    //       .findOneAndUpdate(
    //         { _id: ObjectId(postId) },
    //         { $inc: { likes: 1 } },
    //         { returnOriginal: false }
    //       );
    //     res.json(updatedPost.value);
    //   } catch (error) {
    //     res.status(500).json({ error: error.message });
    //   }
    // });

    // app.post('/surveys/survey/:id/like', async (req, res) => {
    //   const postId = req.params.postId;
    
    //   const post = await surveyCollection.findOne({ _id: ObjectId(postId) });
    
    //   if (!post) {
    //     return res.status(404).json({ error: 'Post not found' });
    //   }
    
    //   const newLikes = post.likes + 1;
    
    //   await surveyCollection.updateOne(
    //     { _id: ObjectId(postId) },
    //     { $set: { likes: newLikes } }
    //   );
    
    //   return res.status(200).json({ likes: newLikes });
    // });
    
    // app.post('/surveys/survey/:id/unlike', async (req, res) => {
    //   const postId = req.params.postId;
    
    //   const post = await surveyCollection.findOne({ _id: ObjectId(postId) });
    
    //   if (!post) {
    //     return res.status(404).json({ error: 'Post not found' });
    //   }
    
    //   const newUnlikes = post.unlikes + 1;
    
    //   await surveyCollection.updateOne(
    //     { _id: ObjectId(postId) },
    //     { $set: { unlikes: newUnlikes } }
    //   );
    
    //   return res.status(200).json({ unlikes: newUnlikes });
    // });

    app.delete('/surveys/:id',verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await surveyCollection.deleteOne(query);
      res.send(result);
    })

    // app.get('/surveys/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) }
    //   const result = await surveyCollection.findOne(query);
    //   res.send(result);
    // })

    app.post('/surveys',verifyToken, async (req, res) => {
      const item = req.body;
      const result = await surveyCollection.insertOne(item);
      res.send(result);
    });


// contact us

    app.get('/contact', async (req, res) => {
      const result = await contactUsCollection.find().toArray();
      res.send(result);
    });

    app.post('/contact',async (req, res) => {
      const item = req.body;
      const result = await contactUsCollection.insertOne(item);
      res.send(result);
    });
    // vote 


    app.get('/vote',                async (req, res) => {
      const result = await voteCollection.find().toArray();
      res.send(result);
    });

    app.post('/vote', async (req, res) => {
      const item = req.body;
      const result = await voteCollection.insertOne(item);
      res.send(result);
    });

       app.patch('/surveys/report/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          Report : true
        }
      }
      const result = await surveyCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })
    // reviews


    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })


    // payments


    // payment intent

    app.post('/create-payment-intent',verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });


    app.get('/payments/:email',verifyToken,verifyAdmin, async (req, res) => {
      const query = { email: req.params.email }
      console.log('eamial', email);
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    // app.post('/payments', async (req, res) => {
    //   const payment = req.body;
    //   const paymentResult = await paymentCollection.insertOne(payment);

    //   //  carefully delete each item from the cart
    //   console.log('payment info', payment);
    //   const query = {
    //     _id: {
    //       $in: payment.cartIds.map(id => new ObjectId(id))
    //     }
    //   };

    //   const deleteResult = await cartCollection.deleteMany(query);

    //   res.send({ paymentResult, deleteResult });
    // })
    app.post('/payments', async (req, res) => {
      const item = req.body;
      const result = await paymentCollection.insertOne(item);
      res.send(result);
    });

    app.get('/payments', async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('survey!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})




