import React, { createContext, useContext, useState, useMemo } from 'react';

const CartContext = createContext(null);

function createIdempotencyKey() {
  return `IDEMP_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey());

  const addToCart = (product, quantity = 1) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.product.id === product.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + quantity;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty
        };
        return updated;
      } else {
        return [...prev, { product, quantity }];
      }
    });
  };

  const updateQuantity = (productId, newQuantity) => {
    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setItems([]);
    setIdempotencyKey(createIdempotencyKey());
  };

  const resetIdempotencyKey = () => {
    setIdempotencyKey(createIdempotencyKey());
  };

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + parseFloat(item.product.selling_price) * item.quantity;
    }, 0);
  }, [items]);

  const totalUnits = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const value = {
    items,
    totalAmount: subtotal,
    totalUnits,
    idempotencyKey,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    resetIdempotencyKey
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
