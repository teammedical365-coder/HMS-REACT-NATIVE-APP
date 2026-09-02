import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useAuth } from '../../store/hooks';
import HomeScreen from '../../screens/HomeScreen';
import DashboardScreen from '../../screens/DashboardScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// Placeholder screens — replace with actual implementations
const PatientScreen = () => <HomeScreen title="Patient Portal" />;
const DoctorScreen = () => <HomeScreen title="Doctor Dashboard" />;
const ReceptionScreen = () => <HomeScreen title="Reception" />;
const PharmacyScreen = () => <HomeScreen title="Pharmacy" />;
const LabScreen = () => <HomeScreen title="Lab" />;
const AdminScreen = () => <HomeScreen title="Admin" />;
const AccountantScreen = () => <HomeScreen title="Accountant" />;

const DrawerNavigator = () => {
    const { user } = useAuth();
    const role = (user?.role || '').toLowerCase();

    return (
        <Drawer.Navigator
            screenOptions={{
                headerShown: true,
                drawerActiveTintColor: '#14b8a6',
            }}
        >
            {role === 'patient' && (
                <>
                    <Drawer.Screen name="PatientDashboard" component={PatientScreen} options={{ title: 'My Appointments' }} />
                </>
            )}
            {role === 'doctor' && (
                <>
                    <Drawer.Screen name="DoctorDashboard" component={DoctorScreen} options={{ title: 'My Appointments' }} />
                </>
            )}
            {role === 'reception' && (
                <>
                    <Drawer.Screen name="ReceptionDashboard" component={ReceptionScreen} options={{ title: 'Appointments' }} />
                </>
            )}
            {role === 'pharmacy' && (
                <>
                    <Drawer.Screen name="PharmacyDashboard" component={PharmacyScreen} options={{ title: 'Inventory' }} />
                </>
            )}
            {role === 'lab' && (
                <>
                    <Drawer.Screen name="LabDashboard" component={LabScreen} options={{ title: 'Lab Reports' }} />
                </>
            )}
            {['admin', 'hospital admin', 'hospitaladmin'].includes(role) && (
                <>
                    <Drawer.Screen name="AdminDashboard" component={AdminScreen} options={{ title: 'Admin' }} />
                </>
            )}
            {role === 'accountant' && (
                <>
                    <Drawer.Screen name="AccountantDashboard" component={AccountantScreen} options={{ title: 'Billing' }} />
                </>
            )}
        </Drawer.Navigator>
    );
};

const MainStack = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="MainDrawer" component={DrawerNavigator} options={{ animationEnabled: false }} />
            <Stack.Screen
                name="Details"
                component={HomeScreen}
                options={{ headerShown: true, title: 'Details' }}
            />
        </Stack.Navigator>
    );
};

export default MainStack;