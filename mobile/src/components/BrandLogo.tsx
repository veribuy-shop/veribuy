import React from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';

interface BrandLogoProps {
  style?: StyleProp<ImageStyle>;
  height?: number;
  width?: number;
}

export function BrandLogo({ style, height = 48, width }: BrandLogoProps) {
  const calculatedWidth = width || Math.round(height * (512 / 279));
  return (
    <Image
      source={require('../../assets/images/veribuy-logo.png')}
      style={[{ width: calculatedWidth, height, resizeMode: 'contain' }, style]}
      accessibilityLabel="VeriBuy Logo"
    />
  );
}
