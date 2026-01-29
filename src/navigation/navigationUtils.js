import React from 'react';

// Navigation reference - used for navigation outside of React components
export const navigationRef = React.createRef();

/**
 * Navigate to a screen from anywhere in the app
 * @param {string} name - Screen name to navigate to
 * @param {Object} params - Navigation parameters
 */
export const navigate = (name, params) => {
  if (navigationRef.current) {
    navigationRef.current.navigate(name, params);
  }
};

/**
 * Go back to the previous screen
 */
export const goBack = () => {
  if (navigationRef.current) {
    navigationRef.current.goBack();
  }
};

/**
 * Reset navigation state
 * @param {Object} state - New navigation state
 */
export const reset = (state) => {
  if (navigationRef.current) {
    navigationRef.current.reset(state);
  }
};
