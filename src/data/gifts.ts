import { Gift } from '../types';
import carImageUrl from '../assets/images/luxury_sports_car_gift_1784825622626.jpg';

export const INITIAL_GIFT_BALANCE = 10; // Welcome Bonus

export const GIFTS: Gift[] = [
  {
    id: 'rose_gift',
    name: 'Magic Rose',
    arabicName: 'الوردة السحرية 🌹',
    icon: '🌹',
    cost: 100,
    xpReward: 1000,
    isPremium: true,
    imageUrl: 'https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/dhf.png'
  },
  {
    id: 'new_svga_gift',
    name: 'Luxury Sports Car',
    arabicName: 'سيارة بورش الفاخرة 🏎️',
    icon: '🏎️',
    cost: 1000,
    xpReward: 15000,
    isPremium: true,
    svgaUrl: 'https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/posche.svga',
    imageUrl: carImageUrl
  },
  {
    id: 'cp_gift',
    name: 'CP Covenant',
    arabicName: 'عقد الارتباط (سي بي)',
    icon: '💝',
    cost: 100,
    xpReward: 1500,
    isPremium: true,
    imageUrl: 'https://img.icons8.com/color/96/000000/heart-with-arrow.png'
  },
  {
    id: 'friend_gift',
    name: 'Best Friend Ring',
    arabicName: 'خاتم الصداقة المقربة',
    icon: '💍',
    cost: 500,
    xpReward: 300,
    isPremium: true,
    svgaUrl: 'https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/kkkkkkkkkk.mp4',
    imageUrl: 'https://img.icons8.com/color/96/000000/diamond-ring.png'
  },
  {
    id: 'squirrel_gift',
    name: 'Squirrel',
    arabicName: 'السنجاب 🐿️',
    icon: '🐿️',
    cost: 150,
    xpReward: 1500,
    isPremium: true,
    imageUrl: 'https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/djfk.png'
  },
  {
    id: 'balloon_gift',
    name: 'Balloon',
    arabicName: 'البالون 🎈',
    icon: '🎈',
    cost: 500,
    xpReward: 5000,
    isPremium: true,
    imageUrl: 'https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/dfsd.png'
  },
  {
    id: 'kafu_gift',
    name: 'Kafu',
    arabicName: 'كفو',
    icon: '👏',
    cost: 500,
    xpReward: 5000,
    isPremium: true,
    imageUrl: 'https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/jkhkj.png'
  },
  {
    id: 'necklace_gift',
    name: 'Necklace',
    arabicName: 'قلادة',
    icon: '📿',
    cost: 500,
    xpReward: 5000,
    isPremium: true,
    imageUrl: 'https://gtkjonqlumuhsuykbxnw.supabase.co/storage/v1/object/public/images/ihdis.png'
  },
];
