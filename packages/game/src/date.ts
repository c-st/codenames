export const advanceDateBySeconds = (date: Date, seconds: number): Date => {
  return new Date(date.getTime() + seconds * 1000);
};
