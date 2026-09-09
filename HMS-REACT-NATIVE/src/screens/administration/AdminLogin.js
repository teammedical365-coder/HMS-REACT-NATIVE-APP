import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { sendOtp, verifyOtp, resendOtp, forceLogin, clearError, resetOtpFlow } from '../../store/slices/authSlice';
import NeuralAuthPortal from '../../components/auth/NeuralAuthPortal';

const AdminLogin = () => {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();
    const { loading, error, isAuthenticated, user, otpStep, preAuthToken, otpEmail, activeSession, otpSuccessMsg } = useAuth();

    useEffect(() => {
        dispatch(clearError());
        dispatch(resetOtpFlow());
    }, [dispatch]);

    useEffect(() => {
        if (isAuthenticated && user) {
            const normalizedRole = user?.role ? user.role.toLowerCase() : '';
            let targetPath = 'UserDrawer'; // Fallback
            
            if (normalizedRole === 'centraladmin' || normalizedRole === 'superadmin') {
                targetPath = 'CentralAdminDrawer';
            } else if (normalizedRole === 'hospitaladmin') {
                targetPath = 'HospitalAdminDrawer';
            } else if (normalizedRole === 'admin') {
                targetPath = 'AdminDrawer';
            }

            navigation.navigate(targetPath);
        }
    }, [isAuthenticated, user, navigation]);

    const handleLoginSubmit = ({ id, password }) => {
        dispatch(clearError());
        dispatch(sendOtp({
            email: id,
            password: password,
            loginType: 'admin',
        }));
    };

    const handleVerifyOtp = async (otp) => {
        await dispatch(verifyOtp({ preAuthToken, otp }));
    };

    const handleResendOtp = async () => {
        await dispatch(resendOtp({ preAuthToken }));
    };

    const handleBackToLogin = () => {
        dispatch(resetOtpFlow());
    };

    const handleForceLogin = async () => {
        await dispatch(forceLogin({ preAuthToken }));
    };

    const handleCancelSession = () => {
        dispatch(resetOtpFlow());
    };

    return (
        <NeuralAuthPortal
            portalType="admin"
            title="Admin Portal"
            subtitle="Access administrator medical management workspace."
            idLabel="Administrator Email"
            idPlaceholder="admin@medical365.in"
            idType="email-address"
            passkeyLabel="Password"
            passkeyPlaceholder="••••••••"
            onLoginSubmit={handleLoginSubmit}
            onVerifyOtp={handleVerifyOtp}
            onResendOtp={handleResendOtp}
            onAbortOtp={handleBackToLogin}
            onForceLogin={handleForceLogin}
            onCancelSession={handleCancelSession}
            otpStep={otpStep}
            otpEmail={otpEmail}
            activeSession={activeSession}
            loading={loading}
            error={error}
            successMsg={otpSuccessMsg}
        />
    );
};

export default AdminLogin;
