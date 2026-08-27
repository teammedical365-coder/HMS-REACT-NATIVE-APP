import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userToken, setUserToken] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [tenantId, setTenantId] = useState(null);
    const [user, setUser] = useState(null);

    // Initial load from AsyncStorage
    const checkAuthStatus = async () => {
        try {
            setIsLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            const role = await AsyncStorage.getItem('userRole');
            const tenant = await AsyncStorage.getItem('tenantId');
            const userDataStr = await AsyncStorage.getItem('user');

            if (token) {
                setUserToken(token);
                setUserRole(role);
                setTenantId(tenant);
                if (userDataStr) {
                    setUser(JSON.parse(userDataStr));
                }
            }
        } catch (error) {
            console.error('Auth check error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkAuthStatus();
    }, []);

    const login = async (token, role, tenant, userData) => {
        try {
            setIsLoading(true);
            await AsyncStorage.setItem('authToken', token);
            await AsyncStorage.setItem('userRole', role || '');
            if (tenant) {
                await AsyncStorage.setItem('tenantId', tenant);
            }
            if (userData) {
                await AsyncStorage.setItem('user', JSON.stringify(userData));
            }
            
            setUserToken(token);
            setUserRole(role);
            setTenantId(tenant);
            setUser(userData);
        } catch (error) {
            console.error('Login error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        try {
            setIsLoading(true);
            await AsyncStorage.removeItem('authToken');
            await AsyncStorage.removeItem('userRole');
            await AsyncStorage.removeItem('tenantId');
            await AsyncStorage.removeItem('user');
            
            setUserToken(null);
            setUserRole(null);
            setTenantId(null);
            setUser(null);
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{
            isLoading,
            userToken,
            userRole,
            tenantId,
            user,
            login,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};
