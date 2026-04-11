import React from 'react';

/**
 * React Native-like Primitives for Web
 * These provide the look and feel requested (View, Text, Image) 
 * while running in the browser using HTML5.
 */

export const View = ({ children, style = {}, className = "", ...props }) => (
    <div 
        className={`flex flex-col ${className}`} 
        style={{ display: 'flex', flexDirection: 'column', ...style }} 
        {...props}
    >
        {children}
    </div>
);

export const Text = ({ children, style = {}, className = "", ...props }) => (
    <span 
        className={`${className}`} 
        style={{ ...style }} 
        {...props}
    >
        {children}
    </span>
);

export const Image = ({ src, alt, style = {}, className = "", ...props }) => (
    <img 
        src={src} 
        alt={alt} 
        className={`${className}`} 
        style={{ objectFit: 'cover', ...style }} 
        {...props} 
    />
);

export const TouchableOpacity = ({ children, onPress, style = {}, className = "", ...props }) => (
    <button 
        onClick={onPress}
        className={`active:opacity-70 transition-all ${className}`}
        style={{ border: 'none', cursor: 'pointer', ...style }}
        {...props}
    >
        {children}
    </button>
);

export const ScrollView = ({ children, style = {}, className = "", ...props }) => (
    <div 
        className={`overflow-y-auto ${className}`} 
        style={{ ...style }} 
        {...props}
    >
        {children}
    </div>
);
