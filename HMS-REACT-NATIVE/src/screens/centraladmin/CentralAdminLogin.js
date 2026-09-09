import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { sendOtp, verifyOtp, resendOtp, forceLogin, clearError, resetOtpFlow } from '../../store/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NeuralAuthPortal from '../../components/auth/NeuralAuthPortal';

const CentralAdminLogin = () => {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();
    const { loading, error, isAuthenticated, user, otpStep, preAuthToken, otpEmail, activeSession, otpSuccessMsg } = useAuth();
    const [sessionBanner, setSessionBanner] = useState(null);

    useEffect(() => {
        const checkSessionBanner = async () => {
            try {
                const msg = await AsyncStorage.getItem('sessionExpiredMessage');
                if (msg) {
                    setSessionBanner(msg);
                    await AsyncStorage.removeItem('sessionExpiredMessage');
                }
            } catch (e) {}
        };
        checkSessionBanner();
    }, []);

    useEffect(() => {
        dispatch(clearError());
        dispatch(resetOtpFlow());
    }, [dispatch]);

    useEffect(() => {
        if (isAuthenticated && user) {
            navigation.navigate('CentralAdminDrawer');
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
            title="Supreme Portal"
            subtitle="Access Medical365 central system administration core."
            idLabel="Administrator Email"
            idPlaceholder="Enter your administrator email"
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
            sessionBanner={sessionBanner}
        />
    );
};

export default CentralAdminLogin;