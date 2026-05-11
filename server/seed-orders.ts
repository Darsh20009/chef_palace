import mongoose from "mongoose";
import { OrderModel, EmployeeModel, BranchModel, CustomerModel } from "../shared/schema";

async function seedOrders() {
  try {
    console.log("🚀 Starting orders seed process...");

    const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/coffee-shop";
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Get employees, branches, and customers
    const employees = await EmployeeModel.find({ role: { $in: ["cashier", "manager", "admin"] } });
    const branches = await BranchModel.find();
    const customers = await CustomerModel.find();

    if (employees.length === 0 || branches.length === 0) {
      console.log("❌ No employees or branches found. Please run seed-managers.ts first");
      process.exit(1);
    }

    console.log(`📊 Found ${employees.length} employees, ${branches.length} branches, ${customers.length} customers`);

    // Sample coffee items
    const sampleItems = [
      {
        coffeeItemId: "espresso-single",
        quantity: 2,
        price: 12,
        size: "small",
        notes: ""
      },
      {
        coffeeItemId: "cafe-latte",
        quantity: 1,
        price: 18,
        size: "medium",
        notes: "بدون سكر"
      },
      {
        coffeeItemId: "cappuccino",
        quantity: 1,
        price: 16,
        size: "large",
        notes: ""
      },
      {
        coffeeItemId: "americano",
        quantity: 3,
        price: 14,
        size: "medium",
        notes: "ساخن"
      },
      {
        coffeeItemId: "iced-latte",
        quantity: 2,
        price: 20,
        size: "large",
        notes: "بارد جداً"
      }
    ];

    const statuses = ["pending", "payment_confirmed", "in_progress", "ready", "completed"];
    const paymentMethods = ["cash", "mada", "visa", "mastercard", "stcpay"];

    // Create 20 sample orders
    const ordersToCreate = 20;
    let createdCount = 0;

    for (let i = 0; i < ordersToCreate; i++) {
      const employee = employees[Math.floor(Math.random() * employees.length)];
      const branch = branches[Math.floor(Math.random() * branches.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      
      // Randomly select 1-3 items
      const numItems = Math.floor(Math.random() * 3) + 1;
      const orderItems = [];
      let total = 0;
      
      for (let j = 0; j < numItems; j++) {
        const item = sampleItems[Math.floor(Math.random() * sampleItems.length)];
        orderItems.push({ ...item });
        total += item.price * item.quantity;
      }

      // Randomly assign customer if available
      const customerId = customers.length > 0 && Math.random() > 0.3 
        ? (customers[Math.floor(Math.random() * customers.length)]._id as any).toString()
        : undefined;

      const orderData: any = {
        orderNumber: `ORD#${(i + 1).toString().padStart(4, '0')}`,
        items: orderItems,
        totalAmount: total,
        status,
        paymentMethod,
        employeeId: (employee._id as any).toString(),
        branchId: (branch._id as any).toString(),
        orderType: Math.random() > 0.5 ? "dine-in" : "regular",
        customerInfo: customerId ? undefined : {
          name: `عميل ${i + 1}`,
          phone: `05${Math.floor(Math.random() * 90000000 + 10000000)}`
        },
        customerId,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)), // Random date within last 7 days
      };

      await OrderModel.create(orderData);
      createdCount++;
      console.log(`✅ Created order ${i + 1}/${ordersToCreate}: ${orderData.orderNumber} (${status})`);
    }

    console.log(`\n🎉 Successfully created ${createdCount} sample orders!`);
    console.log("💡 You can now see these orders in the manager dashboard");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  }
}

seedOrders();
