import { useDispatch, useSelector } from 'react-redux';

export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;

export const useAuth = () => useAppSelector((state) => state.auth);

export const useAppointments = () => useAppSelector((state) => state.appointments);

export const useDoctors = () => useAppSelector((state) => state.doctors);

export const usePublicData = () => useAppSelector((state) => state.publicData);

export const useAdminEntities = () => useAppSelector((state) => state.adminEntities);

export const useServices = () => useAppSelector((state) => state.services);

export const useNotifications = () => useAppSelector((state) => state.notifications);

export const useCachedServices = () => {
  const { services, loading, error } = useAppSelector((state) => state.publicData);
  return { services: services || [], loading, error, isCached: false };
};

export const useCachedDoctors = (serviceId = null) => {
  const { doctors, loading, error } = useAppSelector((state) => state.publicData);
  return { doctors: doctors || [], loading, error, isCached: false };
};