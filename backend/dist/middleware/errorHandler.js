"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    console.error("Error:", err.message);
    res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
    });
};
exports.errorHandler = errorHandler;
