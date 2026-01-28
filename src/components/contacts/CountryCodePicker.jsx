import { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import { Text, TextInput, Portal } from 'react-native-paper';
import Modal from 'react-native-modal';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { countries, DEFAULT_COUNTRY } from '../../data/countries';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CountryCodePicker = ({
  selectedCountry,
  onSelectCountry,
  disabled = false,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countries;
    const query = searchQuery.toLowerCase().trim();
    return countries.filter(
      (country) =>
        country.label.toLowerCase().includes(query) ||
        country.phone.includes(query) ||
        country.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelectCountry = (country) => {
    onSelectCountry(country);
    setIsModalVisible(false);
    setSearchQuery('');
  };

  const openPicker = () => {
    if (!disabled) {
      setIsModalVisible(true);
    }
  };

  const closePicker = () => {
    setIsModalVisible(false);
    setSearchQuery('');
  };

  const renderCountryItem = ({ item }) => {
    const isSelected = selectedCountry?.code === item.code;
    return (
      <TouchableOpacity
        style={[styles.countryItem, isSelected && styles.countryItemSelected]}
        onPress={() => handleSelectCountry(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.countryFlag}>{item.flag}</Text>
        <View style={styles.countryInfo}>
          <Text style={styles.countryName} numberOfLines={1}>
            {item.label}
          </Text>
          <Text style={styles.countryPhone}>+{item.phone}</Text>
        </View>
        {isSelected && (
          <Icon name="check-circle" size={20} color={colors.primary.main} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      {/* Country Code Button */}
      <TouchableOpacity
        style={[styles.pickerButton, disabled && styles.pickerButtonDisabled]}
        onPress={openPicker}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={styles.flagText}>{selectedCountry?.flag || DEFAULT_COUNTRY.flag}</Text>
        <Text style={styles.codeText}>+{selectedCountry?.phone || DEFAULT_COUNTRY.phone}</Text>
        <Icon name="chevron-down" size={18} color={colors.text.secondary} />
      </TouchableOpacity>

      {/* Country Selection Modal */}
      <Modal
        isVisible={isModalVisible}
        onBackdropPress={closePicker}
        onSwipeComplete={closePicker}
        swipeDirection={['down']}
        style={styles.modal}
        backdropOpacity={0.5}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        avoidKeyboard={true}
      >
        <View style={styles.modalContainer}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Country</Text>
            <TouchableOpacity onPress={closePicker} style={styles.closeButton}>
              <Icon name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Icon name="magnify" size={20} color={colors.text.tertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search country or code..."
              placeholderTextColor={colors.text.tertiary}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Country List */}
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            renderItem={renderCountryItem}
            style={styles.countryList}
            contentContainerStyle={styles.countryListContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Icon name="map-search" size={48} color={colors.grey[300]} />
                <Text style={styles.emptyText}>No countries found</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Picker Button
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.grey[300],
    gap: 6,
    marginRight: 8,
  },
  pickerButtonDisabled: {
    opacity: 0.5,
  },
  flagText: {
    fontSize: 20,
  },
  codeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },

  // Modal
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContainer: {
    backgroundColor: colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.75,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.grey[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey[100],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[100],
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
    backgroundColor: 'transparent',
  },

  // Country List
  countryList: {
    flex: 1,
  },
  countryListContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
    gap: 12,
  },
  countryItemSelected: {
    backgroundColor: colors.primary.lighter,
  },
  countryFlag: {
    fontSize: 24,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  countryPhone: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.secondary,
  },
});

export default CountryCodePicker;
