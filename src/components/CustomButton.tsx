import React from 'react';
import { Button, ButtonProps } from '@mui/material';
import { styled } from '@mui/material/styles';

interface CustomButtonProps extends ButtonProps {
  hoverColor?: string;
  hoverBackground?: string;
}

const StyledButton = styled(Button)<CustomButtonProps>(({ theme, hoverColor, hoverBackground }) => ({
  position: 'relative',
  overflow: 'hidden',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  transform: 'translateY(0)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
    opacity: 0,
    transition: 'opacity 0.3s ease',
  },
  
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
    color: hoverColor || 'inherit',
    backgroundColor: hoverBackground || 'inherit',
    
    '&::before': {
      opacity: 1,
    },
  },
  
  '&:active': {
    transform: 'translateY(0)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    transition: 'all 0.1s ease',
  },
  
  // Ripple effect enhancement
  '& .MuiTouchRipple-root': {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  
  // Primary variant enhancements
  '&.MuiButton-containedPrimary': {
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    
    '&:hover': {
      background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
    },
  },
  
  // Secondary variant enhancements
  '&.MuiButton-containedSecondary': {
    background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
    
    '&:hover': {
      background: `linear-gradient(135deg, ${theme.palette.secondary.dark} 0%, ${theme.palette.secondary.main} 100%)`,
    },
  },
  
  // Outlined variant enhancements
  '&.MuiButton-outlined': {
    borderWidth: '2px',
    
    '&:hover': {
      borderWidth: '2px',
      backgroundColor: 'rgba(0, 75, 128, 0.04)',
    },
  },
  
  // Text variant enhancements
  '&.MuiButton-text': {
    '&:hover': {
      backgroundColor: 'rgba(0, 75, 128, 0.04)',
    },
  },
}));

const CustomButton: React.FC<CustomButtonProps> = ({
  children,
  hoverColor,
  hoverBackground,
  ...props
}) => {
  return (
    <StyledButton
      hoverColor={hoverColor}
      hoverBackground={hoverBackground}
      {...props}
    >
      {children}
    </StyledButton>
  );
};

export default CustomButton;