const mongoose = require('mongoose');
require('dotenv').config({path: 'variables.env'});

const conectarDB = async () => {
    try{
        await mongoose.connect(process.env.DB_MONGO, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true
        });
        console.log('DB conectadad');
    } catch(err){
        console.log('Hubo un error');
        console.log(err);
        process.exit(1); // detener la aplicacion
    }
}

module.exports = conectarDB;