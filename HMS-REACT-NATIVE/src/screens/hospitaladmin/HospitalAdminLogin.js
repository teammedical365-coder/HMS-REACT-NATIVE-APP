import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { sendOtp, verifyOtp, resendOtp, forceLogin, clearError, resetOtpFlow } from '../../store/slices/authSlice';
import NeuralAuthPortal from '../../components/auth/NeuralAuthPortal';

const HospitalAdminLogin = () => {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();
    const { loading, error, isAuthenticated, user, otpStep, preAuthToken, otpEmail, activeSession, otpSuccessMsg } = useAuth();

    useEffect(() => {
        dispatch(clearError());
        dispatch(resetOtpFlow());
    }, [dispatch]);

    useEffect(() => {
        if (isAuthenticated && user) {
            const role = user.role?.toLowerCase();
            if (role === 'hospitaladmin') {
                navigation.navigate('HospitalAdminDrawer');
            } else if (role === 'centraladmin' || role === 'superadmin') {
                navigation.navigate('CentralAdminDrawer');
            }
        }
    }, [isAuthenticated, user, navigation]);

    const handleLoginSubmit = ({ id, password }) => {
        dispatch(clearError());
        dispatch(sendOtp({
            email: id,
            password: password,
            loginType: 'hospitaladmin',
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
            portalType="hospital"
            title="Hospital Portal"
            subtitle="Access dedicated hospital administrator workspace."
            idLabel="Hospital Admin Email"
            idPlaceholder="admin@yourhospital.com"
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

export default HospitalAdminLogin;
