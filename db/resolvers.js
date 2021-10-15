const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Cliente = require("../models/Cliente");
const Pedido = require("../models/Pedido");
require("dotenv").config({ path: "variables.env" });

const crearToken = (usuario, secreta, expiresIn) => {
  console.log(usuario);
  const { id, email, nombre, apellido } = usuario;

  return jwt.sign({ id }, secreta, { expiresIn });
};

//Resolvers
const resolvers = {
  Query: {
    obtenerUsuario: async (_, { token }) => {
      const usuarioId = await jwt.verify(token, process.env.SECRETA);

      return usuarioId;
    },
    obternerProductos: async () => {
      try {
        const productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.log(error);
      }
    },
    obternerProducto: async (_, { id }) => {
      //Verificar si existe el producto
      const producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }
      return producto;
    },
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({});
        return clientes;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerClientesVendedor: async (_, {}, ctx) => {
      try {
        const clientes = await Cliente.find({
          vendedor: ctx.usuario.id,
        });
        return clientes;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerCliente: async (_, { id }, ctx) => {
      const cliente = await Cliente.findById(id);
      //Verificar si el cliente existe
      if (!cliente) {
        throw new Error("Cliente no encontrado");
      }
      // Verificar si es posible verlo por quien lo creo
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      return cliente;
    },
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({});
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedidosVendedor: async (_, {}, ctx) => {
      try {
        const pedidos = await Pedido.find({ vendedor: ctx.usuario.id });
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedido: async (_, { id }, ctx) => {
      const pedido = await Pedido.findById(id);
      // Verificar si el pedido existe
      if (!pedido) {
        throw new Error("Cliente no encontrado");
      }
      // solo quien lo creo puede ver
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      return pedido;
    },
    obtenerPedidosEstado: async (_, { estado }, ctx) => {
      const pedido = await Pedido.find({
        vendedor: ctx.usuario.id,
        estado: estado,
      });
      return pedido;
    },
    mejoresClientes: async () => {
      const clientes = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$cliente",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "clientes",
            localField: "_id",
            foreignField: "_id",
            as: "cliente",
          },
        },
        {
          $sort: { total: -1 },
        },
      ]);
      return clientes;
    },
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$vendedor",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "usuarios",
            localField: "_id",
            foreignField: "_id",
            as: "vendedor",
          },
        },
        {
          $limit: 3,
        },
        {
          $sort: { total: -1 },
        },
      ]);
      return vendedores;
    },
    buscarProducto: async (_, { texto }) => {
      const productos = await Producto.find({
        $text: { $search: texto },
      }).limit(10);

      return productos;
    },
  },
  Mutation: {
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;

      // Revisar si el usuario ya esta registrado
      const existeUsuario = await Usuario.findOne({ email });
      if (existeUsuario) {
        throw new Error("El usuario ya esta registrado");
      }

      // Hashear su password
      const salt = await bcryptjs.genSalt(10);
      input.password = await bcryptjs.hash(password, salt);

      try {
        // Guardarlo en la base de datos
        const usuario = new Usuario(input);
        usuario.save(); // guardarlo
        return usuario;
      } catch (error) {
        console.log(error);
      }
    },
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;

      //si el usuario existe
      const existeUsuario = await Usuario.findOne({ email });
      if (!existeUsuario) {
        throw new Error("El usuario no existe");
      }

      // Revisar si el password es correcto
      const passwordCorrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );
      if (!passwordCorrecto) {
        throw new Error("El Password es Incorrecto");
      }

      // Crear el token
      return {
        token: crearToken(existeUsuario, process.env.SECRETA, "24h"),
      };
    },
    nuevoProducto: async (_, { input }) => {
      try {
        // Guardarlo en la base de datos
        const producto = new Producto(input);
        const resultado = await producto.save(); // guardarlo
        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    updateProducto: async (_, { id, input }) => {
      //si el producto existe
      let producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }
      producto = await Producto.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return producto;
    },
    eliminarProducto: async (_, { id }) => {
      let producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }
      await Producto.findOneAndDelete({ _id: id });
      return "Producto Eliminado";
    },
    nuevoCliente: async (_, { input }, ctx) => {
      console.log(ctx);
      const { email } = input;
      cliente = await Cliente.findOne({ email });
      if (cliente) {
        throw new Error("Ese cliente ya esta registrado");
      }

      const nuevoCliente = new Cliente(input);

      // asignar al vendedor
      // nuevoCliente.vendedor = "615e48bd39b24615a45e07d0";
      nuevoCliente.vendedor = ctx.usuario.id;

      // guardarlo  en la base de datos
      try {
        const result = await nuevoCliente.save();
        return result;
      } catch (error) {
        console.log(error);
      }
    },
    actualizarCliente: async (_, { id, input }, ctx) => {
      //si el cliente existe
      let cliente = await Cliente.findById(id);

      if (!cliente) {
        throw new Error("Cliente no existe");
      }
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      cliente = await Cliente.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return cliente;
    },
    eliminarCliente: async (_, { id }, ctx) => {
      let cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("Cliente no encontrado");
      }
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      await Cliente.findOneAndDelete({ _id: id });
      return "Cliente Eliminado";
    },
    nuevoPedido: async (_, { input }, ctx) => {
      const { cliente, pedido } = input;
      let clienteNuevo = await Cliente.findById(cliente);
      // Verificar si existe o no
      if (!clienteNuevo) {
        throw new Error("Ese cliente no existe");
      }

      // Verificar si el cliente es del vendedor
      if (clienteNuevo.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      //Revisar que el Stock este disponible
      for await (const articulo of pedido) {
        const { id } = articulo;
        const producto = await Producto.findById(id);
        if (articulo.cantidad > producto.existencia) {
          throw new Error(
            `El Articulo: ${producto.nombre} excede la cantidad disponible`
          );
        } else {
          // restar la cantidad a lo disponible
          producto.existencia = producto.existencia - articulo.cantidad;
          await producto.save();
        }
      }
      // Crear nuevo pedido
      const nuevoPedido = new Pedido(input);
      //asiganerle un vendedor
      nuevoPedido.vendedor = ctx.usuario.id;
      // Guardar en la base de datos
      const resultado = await nuevoPedido.save(); // guardarlo
      return resultado;
    },
    actualizarPedido: async (_, { id, input }, ctx) => {
      const { cliente } = input;
      let pedido = await Pedido.findById(id);
      //si el pedido existe
      if (!pedido) {
        throw new Error("Pedido no existe");
      }
      // si el cliente existe
      const existeCliente = await Cliente.findById(cliente);
      if (!existeCliente) {
        throw new Error("Cliente no existe");
      }
      // si el cliente y el pedido pertenece al vendedor
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      // revisar el stock
      for await (const articulo of pedido) {
        const { id } = articulo;
        const producto = await Producto.findById(id);
        if (articulo.cantidad > producto.existencia) {
          throw new Error(
            `El Articulo: ${producto.nombre} excede la cantidad disponible`
          );
        } else {
          // restar la cantidad a lo disponible
          producto.existencia = producto.existencia - articulo.cantidad;
          await producto.save();
        }
      }
      pedido = await Pedido.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return pedido;
    },
    eliminarPedido: async (_, { id }, ctx) => {
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error("Pedido no encontrado");
      }
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      await Pedido.findOneAndDelete({ _id: id });
      return "Pedido Eliminado";
    },
  },
};

module.exports = resolvers;
