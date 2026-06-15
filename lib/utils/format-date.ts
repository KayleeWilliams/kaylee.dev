import dayjs from "dayjs";

export function formatDate(date: string, format = "MMM YYYY") {
  return dayjs(date).format(format);
}
