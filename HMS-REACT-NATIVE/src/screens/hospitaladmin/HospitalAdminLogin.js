import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { sendOtp, verifyOtp, resendOtp, forceLogin, clearError, resetOtpFlow } from '../../store/slices/authSlice';
import NeuralAuthPortal from '../../components/auth/NeuralAuthPortal';
import { useBranding } from '../../context/BrandingContext';

const HospitalAdminLogin = () => {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();
    const { branding } = useBranding();
    const { loading, error, isAuthenticated, user, otpStep, preAuthToken, otpEmail, activeSession, otpSuccessMsg } = useAuth();

    useEffect(() => {
        dispatch(clearError());
        dispatch(resetOtpFlow());
    }, [dispatch]);

    useEffect(() => {
        if (isAuthenticated && user) {
            // AppNavigator automatically swaps AuthStack with HospitalAdmin or CentralAdmin on isAuthenticated
        }
    }, [isAuthenticated, user]);

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
            branding={branding}
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
            extraFooter={(
                <View style={{ alignItems: 'center', marginTop: 14 }}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Login')}
                        activeOpacity={0.7}
                        style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                    >
                        <Text style={{ color: '#0ea5e9', fontSize: 13, fontWeight: '600' }}>
                            Hospital Staff / Practitioner Login →
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        />
    );
};

export default HospitalAdminLogin;
