import React from 'react';
import { View, StyleSheet } from 'react-native';
import BottomNav from './BottomNav';

export default function Layout({ children }) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {children}
      </View>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    paddingBottom: 80, // Space for bottom nav
  },
}); 