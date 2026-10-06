import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/apiClient';
import { useToast } from '../../context/ToastContext';
import { Modal } from './Modal';

interface ResetDemoButtonProps {
  onResetComplete?: () => void;
  className?: string;
  variant?: 'outline' | 'primary' | 'compact';
}

export const ResetDemoButton: React.FC<ResetDemoButtonProps> = () => {
  return null;
};
