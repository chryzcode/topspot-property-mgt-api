import { User } from "../models/user";
import { UnauthenticatedError, NotFoundError } from "../errors/index";

export default async (req, res, next) => {
  try {
    const { userId } = req.user;
    const user = await User.findOne({ _id: userId });

    if (!user) {
      throw new NotFoundError(`User does not exist`);
    }

    if (user.userType !== "admin") {
      throw new UnauthenticatedError("User is not authorized");
    }

    req.user = { userId: user.id };
    next();
  } catch (error) {
    next(error);
  }
};
