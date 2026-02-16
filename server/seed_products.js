// seed_products.js - Script para crear productos de prueba
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'inventory.db');
const db = new Database(dbPath);

console.log('🌱 Creando productos de prueba...\n');

// Productos de ejemplo para Miss Chulerías
const productosPrueba = [
    // Accesorios
    { name: 'Abanico Decorado', cost_mx: 50, sale_price_manual: 150, category: 'accesorios' },
    { name: 'Felpa de Corazón', cost_mx: 80, sale_price_manual: 250, category: 'peluches' },
    { name: 'Felpa de Oso', cost_mx: 100, sale_price_manual: 300, category: 'peluches' },
    { name: 'Collar de Perlas', cost_mx: 30, sale_price_manual: 120, category: 'joyeria' },
    { name: 'Pulsera de Plata', cost_mx: 150, sale_price_manual: 450, category: 'joyeria' },
    { name: 'Aretes Dorados', cost_mx: 45, sale_price_manual: 180, category: 'joyeria' },
    { name: 'Bolso Elegante', cost_mx: 200, sale_price_manual: 650, category: 'accesorios' },
    { name: 'Cartera de Cuero', cost_mx: 180, sale_price_manual: 550, category: 'accesorios' },
    
    // Peluches
    { name: 'Peluche Stitch', cost_mx: 120, sale_price_manual: 450, category: 'peluches' },
    { name: 'Peluche Winnie Pooh', cost_mx: 110, sale_price_manual: 400, category: 'peluches' },
    { name: 'Peluche Unicornio', cost_mx: 90, sale_price_manual: 350, category: 'peluches' },
    { name: 'Peluche Gato', cost_mx: 85, sale_price_manual: 280, category: 'peluches' },
    
    // Belleza
    { name: 'Esmalte Rojo', cost_mx: 25, sale_price_manual: 80, category: 'belleza' },
    { name: 'Esmalte Rosa', cost_mx: 25, sale_price_manual: 80, category: 'belleza' },
    { name: 'Brillo Labial', cost_mx: 35, sale_price_manual: 120, category: 'belleza' },
    { name: 'Sombra de Ojos', cost_mx: 60, sale_price_manual: 200, category: 'belleza' },
    { name: 'Rímel Negro', cost_mx: 70, sale_price_manual: 250, category: 'belleza' },
    { name: 'Delineador Líquido', cost_mx: 55, sale_price_manual: 180, category: 'belleza' },
    
    // Decoración
    { name: 'Portarretrato Blanco', cost_mx: 120, sale_price_manual: 380, category: 'decoracion' },
    { name: 'Vela Aromática', cost_mx: 40, sale_price_manual: 150, category: 'decoracion' },
    { name: 'Florero de Cristal', cost_mx: 180, sale_price_manual: 550, category: 'decoracion' },
    { name: 'Cuadro Decorativo', cost_mx: 250, sale_price_manual: 750, category: 'decoracion' },
    
    // Regalos
    { name: 'Taza Personalizada', cost_mx: 60, sale_price_manual: 200, category: 'regalos' },
    { name: 'Libreta de Cuero', cost_mx: 80, sale_price_manual: 280, category: 'regalos' },
    { name: 'Pluma Estilográfica', cost_mx: 150, sale_price_manual: 500, category: 'regalos' },
    { name: 'Set de Regalo', cost_mx: 300, sale_price_manual: 950, category: 'regalos' },
    
    // Ropa
    { name: 'Pañuelo de Seda', cost_mx: 70, sale_price_manual: 220, category: 'ropa' },
    { name: 'Gorra Bordada', cost_mx: 90, sale_price_manual: 280, category: 'ropa' },
    { name: 'Bufanda Tejida', cost_mx: 120, sale_price_manual: 380, category: 'ropa' },
];

// Inventarios disponibles
const inventarios = ['mch1', 'mch2', 'alm'];

// Stock por inventario (aleatorio entre 5 y 50)
const getRandomStock = () => Math.floor(Math.random() * 45) + 5;

try {
    // Iniciar transacción
    const insertProduct = db.prepare(`
        INSERT INTO products (name, cost_mx, sale_price_manual, description, image, inventory_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const insertStock = db.prepare(`
        INSERT INTO product_inventory (product_id, inventory_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(product_id, inventory_id) DO UPDATE SET quantity = quantity + excluded.quantity
    `);
    
    let productosCreados = 0;
    
    productosPrueba.forEach((producto, index) => {
        // Insertar producto base
        const result = insertProduct.run(
            producto.name,
            producto.cost_mx,
            producto.sale_price_manual,
            `Producto de prueba - ${producto.category}`,
            null, // sin imagen
            1 // inventory_id default
        );
        
        const productId = result.lastInsertRowid;
        
        // Insertar stock en cada inventario
        inventarios.forEach(invId => {
            insertStock.run(productId, invId, getRandomStock());
        });
        
        productosCreados++;
        console.log(`✅ ${producto.name} - $${producto.sale_price_manual} (Stock: ${getRandomStock()} unidades por sede)`);
    });
    
    console.log(`\n🎉 ${productosCreados} productos creados exitosamente!`);
    console.log(`📦 Stock distribuido en: MCH1, MCH2 y Almacén`);
    
} catch (error) {
    console.error('❌ Error:', error.message);
} finally {
    db.close();
}
