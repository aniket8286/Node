// ============= PACKAGE.JSON =============
/*
{
  "name": "expense-tracker",
  "version": "1.0.0",
  "description": "Personal expense tracking application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.5.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express-validator": "^7.0.1",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
*/

// ============= SERVER.JS =============
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/reports', require('./routes/reports'));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

app.get('/', (req, res) => {
    res.json({ message: 'Expense Tracker API is running!' });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Something went wrong!' });
});

app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// ============= MODELS/USER.JS =============
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    monthlyBudget: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'INR'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);

// ============= MODELS/CATEGORY.JS =============
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    color: {
        type: String,
        default: '#007bff'
    },
    icon: {
        type: String,
        default: 'fas fa-tag'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);

// ============= MODELS/EXPENSE.JS =============
const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        trim: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'upi', 'netbanking', 'other'],
        default: 'cash'
    },
    tags: [{
        type: String,
        trim: true
    }],
    receipt: {
        type: String // URL to uploaded receipt image
    }
}, {
    timestamps: true
});

// Index for better query performance
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);

// ============= MIDDLEWARE/AUTH.JS =============
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.token;
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid token.' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token.' });
    }
};

module.exports = auth;

// ============= ROUTES/AUTH.JS =============
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Category = require('../models/Category');
const auth = require('../middleware/auth');

const router = express.Router();

// Default categories
const defaultCategories = [
    { name: 'Food & Dining', icon: 'fas fa-utensils', color: '#e74c3c' },
    { name: 'Transportation', icon: 'fas fa-car', color: '#3498db' },
    { name: 'Shopping', icon: 'fas fa-shopping-bag', color: '#f39c12' },
    { name: 'Entertainment', icon: 'fas fa-film', color: '#9b59b6' },
    { name: 'Bills & Utilities', icon: 'fas fa-file-invoice', color: '#34495e' },
    { name: 'Healthcare', icon: 'fas fa-heartbeat', color: '#e67e22' },
    { name: 'Education', icon: 'fas fa-graduation-cap', color: '#2ecc71' },
    { name: 'Other', icon: 'fas fa-ellipsis-h', color: '#95a5a6' }
];

// Register
router.post('/register', [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullName').notEmpty().withMessage('Full name is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { username, email, password, fullName, monthlyBudget, currency } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already exists with this email or username' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            fullName,
            monthlyBudget: monthlyBudget || 0,
            currency: currency || 'INR'
        });

        // Create default categories for user
        const categories = defaultCategories.map(cat => ({
            ...cat,
            userId: user._id,
            isDefault: true
        }));
        await Category.insertMany(categories);

        // Generate token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                monthlyBudget: user.monthlyBudget,
                currency: user.currency
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

// Login
router.post('/login', [
    body('identifier').notEmpty().withMessage('Username or email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { identifier, password } = req.body;

        // Find user by email or username
        const user = await User.findOne({
            $or: [{ email: identifier }, { username: identifier }]
        });

        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Generate token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                monthlyBudget: user.monthlyBudget,
                currency: user.currency
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                username: req.user.username,
                email: req.user.email,
                fullName: req.user.fullName,
                monthlyBudget: req.user.monthlyBudget,
                currency: req.user.currency
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update profile
router.put('/profile', auth, [
    body('fullName').optional().notEmpty().withMessage('Full name cannot be empty'),
    body('monthlyBudget').optional().isNumeric().withMessage('Monthly budget must be a number')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { fullName, monthlyBudget, currency } = req.body;
        const updateData = {};

        if (fullName) updateData.fullName = fullName;
        if (monthlyBudget !== undefined) updateData.monthlyBudget = monthlyBudget;
        if (currency) updateData.currency = currency;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

// ============= ROUTES/CATEGORIES.JS =============
const express = require('express');
const { body, validationResult } = require('express-validator');
const Category = require('../models/Category');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all categories for user
router.get('/', auth, async (req, res) => {
    try {
        const categories = await Category.find({ userId: req.user._id })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create new category
router.post('/', auth, [
    body('name').notEmpty().withMessage('Category name is required'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { name, description, color, icon } = req.body;

        // Check if category with same name exists for user
        const existingCategory = await Category.findOne({
            name,
            userId: req.user._id
        });

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'Category with this name already exists'
            });
        }

        const category = await Category.create({
            name,
            description,
            color: color || '#007bff',
            icon: icon || 'fas fa-tag',
            userId: req.user._id
        });

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            category
        });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update category
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, description, color, icon } = req.body;

        const category = await Category.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { name, description, color, icon },
            { new: true, runValidators: true }
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.json({
            success: true,
            message: 'Category updated successfully',
            category
        });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete category
router.delete('/:id', auth, async (req, res) => {
    try {
        const category = await Category.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
            isDefault: false // Prevent deletion of default categories
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found or is a default category'
            });
        }

        res.json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

// ============= ROUTES/EXPENSES.JS =============
const express = require('express');
const { body, validationResult } = require('express-validator');
const Expense = require('../models/Expense');
const Category = require('../models/Category');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all expenses for user with filters
router.get('/', auth, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            category, 
            startDate, 
            endDate, 
            search,
            sortBy = 'date',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = { userId: req.user._id };

        if (category) {
            query.category = category;
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const expenses = await Expense.find(query)
            .populate('category', 'name color icon')
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Expense.countDocuments(query);

        res.json({
            success: true,
            expenses,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get expense by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const expense = await Expense.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).populate('category', 'name color icon');

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.json({
            success: true,
            expense
        });
    } catch (error) {
        console.error('Get expense error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create new expense
router.post('/', auth, [
    body('title').notEmpty().withMessage('Title is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('category').notEmpty().withMessage('Category is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { title, amount, description, category, date, paymentMethod, tags } = req.body;

        // Verify category belongs to user
        const categoryExists = await Category.findOne({
            _id: category,
            userId: req.user._id
        });

        if (!categoryExists) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category'
            });
        }

        const expense = await Expense.create({
            title,
            amount,
            description,
            category,
            userId: req.user._id,
            date: date || new Date(),
            paymentMethod,
            tags: tags || []
        });

        const populatedExpense = await Expense.findById(expense._id)
            .populate('category', 'name color icon');

        res.status(201).json({
            success: true,
            message: 'Expense created successfully',
            expense: populatedExpense
        });
    } catch (error) {
        console.error('Create expense error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update expense
router.put('/:id', auth, async (req, res) => {
    try {
        const { title, amount, description, category, date, paymentMethod, tags } = req.body;

        // If category is being updated, verify it belongs to user
        if (category) {
            const categoryExists = await Category.findOne({
                _id: category,
                userId: req.user._id
            });

            if (!categoryExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid category'
                });
            }
        }

        const expense = await Expense.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { title, amount, description, category, date, paymentMethod, tags },
            { new: true, runValidators: true }
        ).populate('category', 'name color icon');

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.json({
            success: true,
            message: 'Expense updated successfully',
            expense
        });
    } catch (error) {
        console.error('Update expense error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete expense
router.delete('/:id', auth, async (req, res) => {
    try {
        const expense = await Expense.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.json({
            success: true,
            message: 'Expense deleted successfully'
        });
    } catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

// ============= ROUTES/REPORTS.JS =============
const express = require('express');
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/dashboard', auth, async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        // Monthly expenses
        const monthlyExpenses = await Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: { $gte: startOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Yearly expenses
        const yearlyExpenses = await Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: { $gte: startOfYear }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Category-wise breakdown for current month
        const categoryBreakdown = await Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: { $gte: startOfMonth }
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: '$category'
            },
            {
                $project: {
                    _id: 1,
                    total: 1,
                    count: 1,
                    name: '$category.name',
                    color: '$category.color',
                    icon: '$category.icon'
                }
            },
            {
                $sort: { total: -1 }
            }
        ]);

        // Recent expenses
        const recentExpenses = await Expense.find({ userId: req.user._id })
            .populate('category', 'name color icon')
            .sort({ date: -1 })
            .limit(5);

        res.json({
            success: true,
            data: {
                monthly: {
                    total: monthlyExpenses[0]?.total || 0,
                    count: monthlyExpenses[0]?.count || 0,
                    budget: req.user.monthlyBudget,
                    remaining: req.user.monthlyBudget - (monthlyExpenses[0]?.total || 0)
                },
                yearly: {
                    total: yearlyExpenses[0]?.total || 0,
                    count: yearlyExpenses[0]?.count || 0
                },
                categoryBreakdown,
                recentExpenses
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get monthly spending chart data
router.get('/monthly-chart', auth, async (req, res) => {
    try {
        const { year = new Date().getFullYear() } = req.query;

        const monthlyData = await Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: {
                        $gte: new Date(year, 0, 1),
                        $lt: new Date(parseInt(year) + 1, 0, 1)
                    }
                }
            },
            {
                $group: {
                    _id: { $month: '$date' },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const chartData = months.map((month, index) => {
            const data = monthlyData.find(item => item._id === index + 1);
            return {
                month,
                amount: data?.total || 0,
                count: data?.count || 0
            };
        });

        res.json({
            success: true,
            data: chartData
        });
    } catch (error) {
        console.error('Monthly chart error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get expense trends
router.get('/trends', auth, async (req, res) => {
    try {
        const { period = '30' } = req.query;
        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const trends = await Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$date'
                        }
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        res.json({
            success: true,
            data: trends
        });
    } catch (error) {
        console.error('Trends error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

// ============= .ENV FILE TEMPLATE =============
/*
MONGODB_URI=mongodb://localhost:27017/expense-tracker
JWT_SECRET=your-super-secret-jwt-key
PORT=5000
NODE_ENV=development
*/

// ============= ADDITIONAL UTILITY FILES =============

// ============= UTILS/VALIDATION.JS =============
const { body } = require('express-validator');

const expenseValidation = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Title must be between 2 and 100 characters'),
    
    body('amount')
        .isNumeric()
        .withMessage('Amount must be a number')
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be greater than 0'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),
    
    body('category')
        .notEmpty()
        .withMessage('Category is required')
        .isMongoId()
        .withMessage('Invalid category ID'),
    
    body('date')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format'),
    
    body('paymentMethod')
        .optional()
        .isIn(['cash', 'card', 'upi', 'netbanking', 'other'])
        .withMessage('Invalid payment method'),
    
    body('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array')
];

const categoryValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Category name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Category name must be between 2 and 50 characters'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Description cannot exceed 200 characters'),
    
    body('color')
        .optional()
        .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
        .withMessage('Color must be a valid hex color'),
    
    body('icon')
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage('Icon must be between 3 and 50 characters')
];

const userValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please enter a valid email'),
    
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
    body('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters'),
    
    body('monthlyBudget')
        .optional()
        .isNumeric()
        .withMessage('Monthly budget must be a number')
        .isFloat({ min: 0 })
        .withMessage('Monthly budget cannot be negative'),
    
    body('currency')
        .optional()
        .isIn(['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'])
        .withMessage('Invalid currency')
];

module.exports = {
    expenseValidation,
    categoryValidation,
    userValidation
};

// ============= UTILS/HELPERS.JS =============
const mongoose = require('mongoose');

// Format currency
const formatCurrency = (amount, currency = 'INR') => {
    const currencySymbols = {
        INR: '₹',
        USD: ',
        EUR: '€',
        GBP: '£',
        JPY: '¥',
        CAD: 'C,
        AUD: 'A
    };
    
    return `${currencySymbols[currency] || '₹'}${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

// Generate date ranges
const getDateRanges = () => {
    const now = new Date();
    
    return {
        today: {
            start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        },
        thisWeek: {
            start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()),
            end: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 7)
        },
        thisMonth: {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 1)
        },
        thisYear: {
            start: new Date(now.getFullYear(), 0, 1),
            end: new Date(now.getFullYear() + 1, 0, 1)
        },
        lastMonth: {
            start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            end: new Date(now.getFullYear(), now.getMonth(), 1)
        },
        last30Days: {
            start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            end: now
        }
    };
};

// Validate ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

// Generate pagination metadata
const getPaginationMeta = (page, limit, total) => {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? parseInt(page) + 1 : null,
        prevPage: hasPrevPage ? parseInt(page) - 1 : null
    };
};

// Calculate percentage
const calculatePercentage = (part, total) => {
    if (total === 0) return 0;
    return Math.round((part / total) * 100 * 100) / 100;
};

module.exports = {
    formatCurrency,
    getDateRanges,
    isValidObjectId,
    getPaginationMeta,
    calculatePercentage
};

// ============= MIDDLEWARE/ERROR-HANDLER.JS =============
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    console.error('Error:', err);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Invalid ID format';
        error = { message, statusCode: 400 };
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = { message, statusCode: 400 };
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = { message, statusCode: 400 };
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = { message, statusCode: 401 };
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = { message, statusCode: 401 };
    }

    res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;

// ============= MIDDLEWARE/RATE-LIMITER.JS =============
const rateLimit = require('express-rate-limit');

// General rate limiter
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    generalLimiter,
    authLimiter
};

// ============= TESTING ENDPOINTS (FOR DEVELOPMENT) =============

// ============= ROUTES/TEST.JS =============
const express = require('express');
const User = require('../models/User');
const Category = require('../models/Category');
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');

const router = express.Router();

// Only enable in development
if (process.env.NODE_ENV === 'development') {
    
    // Create sample data
    router.post('/seed-data', auth, async (req, res) => {
        try {
            // Get user's categories
            const categories = await Category.find({ userId: req.user._id });
            
            if (categories.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No categories found. Please create categories first.'
                });
            }

            // Sample expenses
            const sampleExpenses = [
                {
                    title: 'Grocery Shopping',
                    amount: 2500,
                    description: 'Weekly grocery shopping at supermarket',
                    category: categories.find(c => c.name === 'Food & Dining')?._id || categories[0]._id,
                    paymentMethod: 'card',
                    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
                },
                {
                    title: 'Uber Ride',
                    amount: 450,
                    description: 'Ride to office',
                    category: categories.find(c => c.name === 'Transportation')?._id || categories[1]._id,
                    paymentMethod: 'upi',
                    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
                },
                {
                    title: 'Movie Tickets',
                    amount: 800,
                    description: 'Weekend movie with friends',
                    category: categories.find(c => c.name === 'Entertainment')?._id || categories[2]._id,
                    paymentMethod: 'card',
                    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
                },
                {
                    title: 'Electricity Bill',
                    amount: 1200,
                    description: 'Monthly electricity bill payment',
                    category: categories.find(c => c.name === 'Bills & Utilities')?._id || categories[3]._id,
                    paymentMethod: 'netbanking',
                    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
                },
                {
                    title: 'Online Shopping',
                    amount: 3200,
                    description: 'Bought clothes and accessories',
                    category: categories.find(c => c.name === 'Shopping')?._id || categories[4]._id,
                    paymentMethod: 'card',
                    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
                }
            ];

            // Add userId to all expenses
            const expensesWithUserId = sampleExpenses.map(expense => ({
                ...expense,
                userId: req.user._id
            }));

            await Expense.insertMany(expensesWithUserId);

            res.json({
                success: true,
                message: 'Sample data created successfully',
                count: sampleExpenses.length
            });
        } catch (error) {
            console.error('Seed data error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating sample data'
            });
        }
    });

    // Clear all user data
    router.delete('/clear-data', auth, async (req, res) => {
        try {
            await Expense.deleteMany({ userId: req.user._id });
            await Category.deleteMany({ userId: req.user._id, isDefault: false });

            res.json({
                success: true,
                message: 'All user data cleared successfully'
            });
        } catch (error) {
            console.error('Clear data error:', error);
            res.status(500).json({
                success: false,
                message: 'Error clearing data'
            });
        }
    });

    // Get database stats
    router.get('/stats', auth, async (req, res) => {
        try {
            const userCount = await User.countDocuments();
            const categoryCount = await Category.countDocuments({ userId: req.user._id });
            const expenseCount = await Expense.countDocuments({ userId: req.user._id });

            res.json({
                success: true,
                stats: {
                    totalUsers: userCount,
                    userCategories: categoryCount,
                    userExpenses: expenseCount
                }
            });
        } catch (error) {
            console.error('Stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching stats'
            });
        }
    });
}

module.exports = router;

// ============= UPDATED SERVER.JS WITH ADDITIONAL FEATURES =============
/*
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const errorHandler = require('./middleware/error-handler');
const { generalLimiter } = require('./middleware/rate-limiter');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(generalLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/reports', require('./routes/reports'));

// Test routes (only in development)
if (process.env.NODE_ENV === 'development') {
    app.use('/api/test', require('./routes/test'));
}

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Basic route
app.get('/', (req, res) => {
    res.json({ 
        message: 'Expense Tracker API is running!',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            expenses: '/api/expenses',
            categories: '/api/categories',
            reports: '/api/reports'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
*/
